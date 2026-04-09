/**
 * @fileoverview Server-side functions for the licenses module.
 * Unified into intratool.db.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { License, SoftwareProduct } from '@/modules/core/types';
import { signLicenseData } from './crypto';
import { authorizeAction } from '@/modules/core/lib/auth-guard';

export async function connectLicensesDb(): Promise<import('better-sqlite3').Database> {
    return connectDb();
}

export async function getLicenses(): Promise<License[]> {
    const db = await connectLicensesDb();
    const results = db.prepare('SELECT * FROM licenses ORDER BY createdAt DESC').all() as License[];
    return JSON.parse(JSON.stringify(results));
}

/**
 * Adds a new license.
 */
export async function addLicense(licenseData: Omit<License, 'id' | 'createdAt'>): Promise<License> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    
    const software = db.prepare('SELECT isInternal FROM software_products WHERE id = ?').get(licenseData.softwareId) as { isInternal: number } | undefined;
    
    if (!software) throw new Error("Producto de software no encontrado.");

    let licenseKey = licenseData.licenseKey;
    let hardwareId = licenseData.hardwareId || null;
    const now = new Date().toISOString();

    if (software.isInternal) {
        if (!hardwareId) throw new Error("El Hardware ID es obligatorio para software propio.");
        
        const licenseInfo = {
            softwareId: licenseData.softwareId,
            customerId: licenseData.customerId,
            hardwareId: hardwareId,
            isPerpetual: licenseData.isPerpetual,
            expirationDate: licenseData.expirationDate,
            createdAt: now,
        };

        licenseKey = await signLicenseData(licenseInfo);
    } else {
        if (!licenseKey) throw new Error("El número de licencia es obligatorio para software de terceros.");
        hardwareId = null;
    }

    const info = db.prepare(`
        INSERT INTO licenses (licenseKey, softwareId, customerId, hardwareId, isPerpetual, expirationDate, status, createdAt)
        VALUES (@licenseKey, @softwareId, @customerId, @hardwareId, @isPerpetual, @expirationDate, @status, @createdAt)
    `).run({
        licenseKey,
        softwareId: licenseData.softwareId,
        customerId: licenseData.customerId,
        hardwareId,
        isPerpetual: licenseData.isPerpetual ? 1 : 0,
        expirationDate: licenseData.expirationDate || null,
        status: 'active',
        createdAt: now
    });

    return db.prepare('SELECT * FROM licenses WHERE id = ?').get(info.lastInsertRowid) as License;
}

/**
 * Updates an existing license.
 */
export async function updateLicense(license: License): Promise<License> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    
    const software = db.prepare('SELECT isInternal FROM software_products WHERE id = ?').get(license.softwareId) as { isInternal: number } | undefined;
    if (!software) throw new Error("Producto de software no encontrado.");

    let licenseKey = license.licenseKey;
    let hardwareId = license.hardwareId || null;

    if (software.isInternal) {
        if (!hardwareId) throw new Error("El Hardware ID es obligatorio para software propio.");
        
        const licenseInfo = {
            softwareId: license.softwareId,
            customerId: license.customerId,
            hardwareId: hardwareId,
            isPerpetual: license.isPerpetual,
            expirationDate: license.expirationDate,
            createdAt: license.createdAt, 
        };

        licenseKey = await signLicenseData(licenseInfo);
    } else {
        if (!licenseKey) throw new Error("El número de licencia es obligatorio para software de terceros.");
        hardwareId = null;
    }

    db.prepare(`
        UPDATE licenses SET licenseKey = @licenseKey, softwareId = @softwareId, customerId = @customerId,
            hardwareId = @hardwareId, isPerpetual = @isPerpetual, expirationDate = @expirationDate, status = @status
        WHERE id = @id
    `).run({
        ...license,
        licenseKey,
        hardwareId,
        isPerpetual: license.isPerpetual ? 1 : 0,
    });
    
    return db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id) as License;
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
    const info = db.prepare(`INSERT INTO software_products (name, isInternal) VALUES (@name, @isInternal)`).run({ ...product, isInternal: product.isInternal ? 1 : 0 });
    return db.prepare('SELECT * FROM software_products WHERE id = ?').get(info.lastInsertRowid) as SoftwareProduct;
}

export async function deleteSoftwareProduct(id: number): Promise<void> {
    await authorizeAction('licenses:manage');
    const db = await connectLicensesDb();
    db.prepare('DELETE FROM software_products WHERE id = ?').run(id);
}
