
/**
 * @fileoverview Server-side functions for the licenses module.
 * Unified into intratool.db.
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
    return results.map(r => ({
        ...r,
        id: Number(r.id),
        m01_val: r.m01_val === 1, m02_val: r.m02_val === 1, m03_val: r.m03_val === 1, m04_val: r.m04_val === 1, m05_val: r.m05_val === 1,
        m06_val: r.m06_val === 1, m07_val: r.m07_val === 1, m08_val: r.m08_val === 1, m09_val: r.m09_val === 1, m10_val: r.m10_val === 1,
        isPerpetual: r.isPerpetual === 1
    })) as unknown as License[];
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
        // Build the rich payload with modules for the signed licenseKey
        const licenseInfo = {
            softwareId: licenseData.softwareId,
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: licenseData.customerId,
            hardwareId: hardwareId,
            activationToken: activationToken,
            isPerpetual: licenseData.isPerpetual,
            expirationDate: licenseData.expirationDate,
            status: 'active', // Important for consistency with API
            createdAt: now,
            modules: {
                m01: licenseData.m01_val, m02: licenseData.m02_val, m03: licenseData.m03_val, m04: licenseData.m04_val, m05: licenseData.m05_val,
                m06: licenseData.m06_val, m07: licenseData.m07_val, m08: licenseData.m08_val, m09: licenseData.m09_val, m10: licenseData.m10_val
            }
        };

        licenseKey = await signLicenseData(licenseInfo);
    } else {
        if (!licenseKey) throw new Error("El número de licencia es obligatorio para software de terceros.");
        hardwareId = null;
    }

    const info = db.prepare(`
        INSERT INTO licenses (
            licenseKey, activationToken, softwareId, customerId, hardwareId, isPerpetual, expirationDate, status, createdAt,
            m01_val, m02_val, m03_val, m04_val, m05_val, m06_val, m07_val, m08_val, m09_val, m10_val
        ) VALUES (
            @licenseKey, @activationToken, @softwareId, @customerId, @hardwareId, @isPerpetual, @expirationDate, 'active', @createdAt,
            @m01_val, @m02_val, @m03_val, @m04_val, @m05_val, @m06_val, @m07_val, @m08_val, @m09_val, @m10_val
        )
    `).run({
        licenseKey,
        activationToken,
        softwareId: licenseData.softwareId,
        customerId: licenseData.customerId,
        hardwareId,
        isPerpetual: licenseData.isPerpetual ? 1 : 0,
        expirationDate: licenseData.expirationDate || null,
        createdAt: now,
        m01_val: licenseData.m01_val ? 1 : 0, m02_val: licenseData.m02_val ? 1 : 0, m03_val: licenseData.m03_val ? 1 : 0, m04_val: licenseData.m04_val ? 1 : 0, m05_val: licenseData.m05_val ? 1 : 0,
        m06_val: licenseData.m06_val ? 1 : 0, m07_val: licenseData.m07_val ? 1 : 0, m08_val: licenseData.m08_val ? 1 : 0, m09_val: licenseData.m09_val ? 1 : 0, m10_val: licenseData.m10_val ? 1 : 0
    });

    const result = db.prepare('SELECT * FROM licenses WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
    return {
        ...result,
        id: Number(result.id),
        m01_val: result.m01_val === 1, m02_val: result.m02_val === 1, m03_val: result.m03_val === 1, m04_val: result.m04_val === 1, m05_val: result.m05_val === 1,
        m06_val: result.m06_val === 1, m07_val: result.m07_val === 1, m08_val: result.m08_val === 1, m09_val: result.m09_val === 1, m10_val: result.m10_val === 1,
        isPerpetual: result.isPerpetual === 1
    } as unknown as License;
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
            modules: {
                m01: license.m01_val, m02: license.m02_val, m03: license.m03_val, m04: license.m04_val, m05: license.m05_val,
                m06: license.m06_val, m07: license.m07_val, m08: license.m08_val, m09: license.m09_val, m10: license.m10_val
            }
        };

        licenseKey = await signLicenseData(licenseInfo);
    } else {
        if (!licenseKey) throw new Error("El número de licencia es obligatorio para software de terceros.");
        hardwareId = null;
    }

    db.prepare(`
        UPDATE licenses SET 
            licenseKey = @licenseKey, softwareId = @softwareId, customerId = @customerId,
            hardwareId = @hardwareId, isPerpetual = @isPerpetual, expirationDate = @expirationDate, status = @status,
            m01_val = @m01_val, m02_val = @m02_val, m03_val = @m03_val, m04_val = @m04_val, m05_val = @m05_val,
            m06_val = @m06_val, m07_val = @m07_val, m08_val = @m08_val, m09_val = @m09_val, m10_val = @m10_val
        WHERE id = @id
    `).run({
        ...license,
        licenseKey,
        hardwareId,
        isPerpetual: license.isPerpetual ? 1 : 0,
        m01_val: license.m01_val ? 1 : 0, m02_val: license.m02_val ? 1 : 0, m03_val: license.m03_val ? 1 : 0, m04_val: license.m04_val ? 1 : 0, m05_val: license.m05_val ? 1 : 0,
        m06_val: license.m06_val ? 1 : 0, m07_val: license.m07_val ? 1 : 0, m08_val: license.m08_val ? 1 : 0, m09_val: license.m09_val ? 1 : 0, m10_val: license.m10_val ? 1 : 0
    });
    
    const result = db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id) as Record<string, unknown>;
    return {
        ...result,
        id: Number(result.id),
        m01_val: result.m01_val === 1, m02_val: result.m02_val === 1, m03_val: result.m03_val === 1, m04_val: result.m04_val === 1, m05_val: result.m05_val === 1,
        m06_val: result.m06_val === 1, m07_val: result.m07_val === 1, m08_val: result.m08_val === 1, m09_val: result.m09_val === 1, m10_val: result.m10_val === 1,
        isPerpetual: result.isPerpetual === 1
    } as unknown as License;
}

export async function deleteLicense(id: number): Promise<void> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    db.prepare('DELETE FROM licenses WHERE id = ?').run(id);
}

export async function getSoftwareProducts(): Promise<SoftwareProduct[]> {
    const db = await connectLicensesDb();
    return db.prepare('SELECT * FROM software_products ORDER BY name').all() as SoftwareProduct[];
}

export async function addSoftwareProduct(product: Omit<SoftwareProduct, 'id'>): Promise<SoftwareProduct> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    const info = db.prepare(`
        INSERT INTO software_products (
            name, isInternal, currentVersion,
            m01_name, m02_name, m03_name, m04_name, m05_name,
            m06_name, m07_name, m08_name, m09_name, m10_name
        ) VALUES (
            @name, @isInternal, @currentVersion,
            @m01_name, @m02_name, @m03_name, @m04_name, @m05_name,
            @m06_name, @m07_name, @m08_name, @m09_name, @m10_name
        )
    `).run({ ...product, isInternal: product.isInternal ? 1 : 0 });
    return db.prepare('SELECT * FROM software_products WHERE id = ?').get(info.lastInsertRowid) as SoftwareProduct;
}

export async function updateSoftwareProduct(product: SoftwareProduct): Promise<SoftwareProduct> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    db.prepare(`
        UPDATE software_products SET 
            name = @name, isInternal = @isInternal, currentVersion = @currentVersion,
            m01_name = @m01_name, m02_name = @m02_name, m03_name = @m03_name, m04_name = @m04_name, m05_name = @m05_name,
            m06_name = @m06_name, m07_name = @m07_name, m08_name = @m08_name, m09_name = @m09_name, m10_name = @m10_name
        WHERE id = @id
    `).run({ ...product, isInternal: product.isInternal ? 1 : 0 });
    return product;
}

export async function deleteSoftwareProduct(id: number): Promise<void> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    db.prepare('DELETE FROM software_products WHERE id = ?').run(id);
}
