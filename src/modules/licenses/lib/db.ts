/**
 * @fileoverview Server-side functions for the licenses module.
 * Unified into intratool.db. Handles Hybrid Protocol v3.9 with 20 modules expansion.
 * Saneado: Eliminación de tipos 'any' para cumplimiento estricto de TypeScript.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { License, SoftwareProduct } from '@/modules/core/types';
import { signLicenseData } from './crypto';
import { authorizeAction } from '@/modules/core/lib/auth-guard';
import crypto from 'crypto';

export async function connectLicensesDb(): Promise<import('better-sqlite3').Database> {
    return connectDb();
}

/**
 * Generates a standard short activation token (XXXX-XXXX).
 */
function generateActivationToken(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-');
}

export async function getLicenses(): Promise<License[]> {
    const db = await connectLicensesDb();
    const results = db.prepare('SELECT * FROM licenses ORDER BY createdAt DESC').all() as Record<string, unknown>[];
    
    return results.map(r => {
        const mapped: License = {
            id: Number(r.id),
            licenseKey: String(r.licenseKey),
            activationToken: r.activationToken ? String(r.activationToken) : undefined,
            softwareId: Number(r.softwareId),
            customerId: r.customerId ? String(r.customerId) : null,
            hardwareId: r.hardwareId ? String(r.hardwareId) : null,
            isPerpetual: r.isPerpetual === 1,
            expirationDate: r.expirationDate ? String(r.expirationDate) : '',
            status: r.status as License['status'],
            createdAt: String(r.createdAt)
        };
        
        // Map all 20 modules using type-safe Object.assign
        for (let i = 1; i <= 20; i++) {
            const key = `m${String(i).padStart(2, '0')}_val` as keyof License;
            const dbKey = `m${String(i).padStart(2, '0')}_val`;
            Object.assign(mapped, { [key]: r[dbKey] === 1 });
        }
        return mapped;
    });
}

/**
 * Adds a new license.
 */
export async function addLicense(licenseData: Omit<License, 'id' | 'createdAt'>): Promise<License> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    
    const software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(licenseData.softwareId) as SoftwareProduct | undefined;
    if (!software) throw new Error("Producto de software no encontrado.");

    let licenseKey = licenseData.licenseKey;
    let hardwareId = licenseData.hardwareId || null;
    const activationToken = software.isInternal ? generateActivationToken() : null;
    const now = new Date().toISOString();

    if (software.isInternal) {
        // Build modules map for the 20 slots
        const modulesMap: Record<string, boolean> = {};
        for (let i = 1; i <= 20; i++) {
            const key = `m${String(i).padStart(2, '0')}`;
            const valKey = `${key}_val` as keyof typeof licenseData;
            modulesMap[key] = !!licenseData[valKey];
        }

        const licenseInfo = {
            softwareId: licenseData.softwareId,
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: licenseData.customerId,
            hardwareId: hardwareId,
            activationToken: activationToken,
            isPerpetual: licenseData.isPerpetual,
            expirationDate: licenseData.expirationDate,
            status: 'active',
            createdAt: now,
            policies: {
                syncFrequencyFree: software.syncFrequencyFree || 7,
                adRefreshFrequency: software.adRefreshFrequency || 2,
                nagScreenTimer: software.nagScreenTimer || 60,
                allowOfflinePremium: !!software.allowOfflinePremium
            },
            modules: modulesMap
        };

        licenseKey = await signLicenseData(licenseInfo);
    } else {
        if (!licenseKey) throw new Error("El número de licencia es obligatorio para software de terceros.");
        hardwareId = null;
    }

    const params: Record<string, unknown> = {
        licenseKey, activationToken, softwareId: licenseData.softwareId,
        customerId: licenseData.customerId, hardwareId, 
        isPerpetual: licenseData.isPerpetual ? 1 : 0, 
        expirationDate: licenseData.expirationDate || null, 
        createdAt: now
    };

    // Add M20 values to params
    for (let i = 1; i <= 20; i++) {
        const key = `m${String(i).padStart(2, '0')}_val` as keyof typeof licenseData;
        params[key as string] = licenseData[key] ? 1 : 0;
    }

    const cols = Object.keys(params).join(', ');
    const placeholders = Object.keys(params).map(k => `@${k}`).join(', ');

    const info = db.prepare(`INSERT INTO licenses (${cols}) VALUES (${placeholders})`).run(params);

    const result = db.prepare('SELECT * FROM licenses WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
    
    const final: License = { 
        id: Number(result.id),
        licenseKey: String(result.licenseKey),
        activationToken: result.activationToken ? String(result.activationToken) : undefined,
        softwareId: Number(result.softwareId),
        customerId: result.customerId ? String(result.customerId) : null,
        hardwareId: result.hardwareId ? String(result.hardwareId) : null,
        isPerpetual: result.isPerpetual === 1,
        expirationDate: result.expirationDate ? String(result.expirationDate) : '',
        status: result.status as License['status'],
        createdAt: String(result.createdAt)
    };
    
    // Map back the 20 modules safely
    for (let i = 1; i <= 20; i++) {
        const key = `m${String(i).padStart(2, '0')}_val` as keyof License;
        const dbKey = `m${String(i).padStart(2, '0')}_val`;
        Object.assign(final, { [key]: result[dbKey] === 1 });
    }
    return final;
}

/**
 * Updates an existing license.
 */
export async function updateLicense(license: License): Promise<License> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    
    const software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(license.softwareId) as SoftwareProduct | undefined;
    if (!software) throw new Error("Producto de software no encontrado.");

    let licenseKey = license.licenseKey;
    let hardwareId = license.hardwareId || null;

    if (software.isInternal) {
        const modulesMap: Record<string, boolean> = {};
        for (let i = 1; i <= 20; i++) {
            const key = `m${String(i).padStart(2, '0')}`;
            const valKey = `${key}_val` as keyof typeof license;
            modulesMap[key] = !!license[valKey];
        }

        const licenseInfo = {
            softwareId: license.softwareId,
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: license.customerId,
            hardwareId: hardwareId,
            activationToken: license.activationToken,
            isPerpetual: license.isPerpetual,
            expirationDate: license.expirationDate,
            status: license.status,
            createdAt: license.createdAt,
            policies: {
                syncFrequencyFree: software.syncFrequencyFree || 7,
                adRefreshFrequency: software.adRefreshFrequency || 2,
                nagScreenTimer: software.nagScreenTimer || 60,
                allowOfflinePremium: !!software.allowOfflinePremium
            },
            modules: modulesMap
        };

        licenseKey = await signLicenseData(licenseInfo);
    } else {
        if (!licenseKey) throw new Error("El número de licencia es obligatorio para software de terceros.");
        hardwareId = null;
    }

    const params: Record<string, unknown> = {
        ...license,
        licenseKey,
        hardwareId,
        isPerpetual: license.isPerpetual ? 1 : 0
    };

    for (let i = 1; i <= 20; i++) {
        const key = `m${String(i).padStart(2, '0')}_val` as keyof typeof license;
        params[key as string] = license[key] ? 1 : 0;
    }

    const setClauses = Object.keys(params)
        .filter(k => k !== 'id')
        .map(k => `${k} = @${k}`)
        .join(', ');

    db.prepare(`UPDATE licenses SET ${setClauses} WHERE id = @id`).run(params);
    
    const result = db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id) as Record<string, unknown>;
    const final: License = { 
        id: Number(result.id),
        licenseKey: String(result.licenseKey),
        activationToken: result.activationToken ? String(result.activationToken) : undefined,
        softwareId: Number(result.softwareId),
        customerId: result.customerId ? String(result.customerId) : null,
        hardwareId: result.hardwareId ? String(result.hardwareId) : null,
        isPerpetual: result.isPerpetual === 1,
        expirationDate: result.expirationDate ? String(result.expirationDate) : '',
        status: result.status as License['status'],
        createdAt: String(result.createdAt)
    };
    
    for (let i = 1; i <= 20; i++) {
        const key = `m${String(i).padStart(2, '0')}_val` as keyof License;
        const dbKey = `m${String(i).padStart(2, '0')}_val`;
        Object.assign(final, { [key]: result[dbKey] === 1 });
    }
    return final;
}

export async function deleteLicense(id: number): Promise<void> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    db.prepare('DELETE FROM licenses WHERE id = ?').run(id);
}

export async function getSoftwareProducts(): Promise<SoftwareProduct[]> {
    const db = await connectLicensesDb();
    const rows = db.prepare('SELECT * FROM software_products ORDER BY name').all() as Record<string, unknown>[];
    return rows.map(r => ({ 
        ...r, 
        id: Number(r.id),
        name: String(r.name),
        isInternal: r.isInternal === 1,
        allowOfflinePremium: r.allowOfflinePremium === 1 
    })) as unknown as SoftwareProduct[];
}

export async function addSoftwareProduct(product: Omit<SoftwareProduct, 'id'>): Promise<SoftwareProduct> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    const params = { 
        ...product, 
        isInternal: product.isInternal ? 1 : 0,
        allowOfflinePremium: product.allowOfflinePremium ? 1 : 0
    };
    
    const cols = Object.keys(params).join(', ');
    const placeholders = Object.keys(params).map(k => `@${k}`).join(', ');

    const info = db.prepare(`INSERT INTO software_products (${cols}) VALUES (${placeholders})`).run(params);
    return db.prepare('SELECT * FROM software_products WHERE id = ?').get(info.lastInsertRowid) as SoftwareProduct;
}

export async function updateSoftwareProduct(product: SoftwareProduct): Promise<SoftwareProduct> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    const params = { 
        ...product, 
        isInternal: product.isInternal ? 1 : 0,
        allowOfflinePremium: product.allowOfflinePremium ? 1 : 0
    };

    const setClauses = Object.keys(params)
        .filter(k => k !== 'id')
        .map(k => `${k} = @${k}`)
        .join(', ');

    db.prepare(`UPDATE software_products SET ${setClauses} WHERE id = @id`).run(params);
    return product;
}

export async function deleteSoftwareProduct(id: number): Promise<void> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    db.prepare('DELETE FROM software_products WHERE id = ?').run(id);
}
