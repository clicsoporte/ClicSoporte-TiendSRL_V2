/**
 * @fileoverview Server-side functions for the licenses module.
 * Unified into intratool.db.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { License, SoftwareProduct } from '@/modules/core/types';
import { signLicenseData } from './crypto';

export async function connectLicensesDb(): Promise<import('better-sqlite3').Database> {
    return connectDb();
}

export async function getLicenses(): Promise<License[]> {
    const db = await connectLicensesDb();
    const results = db.prepare('SELECT * FROM licenses ORDER BY createdAt DESC').all() as License[];
    return JSON.parse(JSON.stringify(results));
}

export async function addLicense(licenseData: Omit<License, 'id' | 'createdAt' | 'licenseKey'>): Promise<License> {
    const db = await connectLicensesDb();
    if (!licenseData.hardwareId) throw new Error("El Hardware ID es obligatorio.");
    
    const licenseInfo = {
        softwareId: licenseData.softwareId,
        clientCompanyId: licenseData.clientCompanyId,
        hardwareId: licenseData.hardwareId,
        isPerpetual: licenseData.isPerpetual,
        expirationDate: licenseData.expirationDate,
        createdAt: new Date().toISOString(),
    };

    const signedLicenseJson = await signLicenseData(licenseInfo);
    const info = db.prepare(`
        INSERT INTO licenses (licenseKey, softwareId, clientCompanyId, hardwareId, isPerpetual, expirationDate, status, createdAt)
        VALUES (@licenseKey, @softwareId, @clientCompanyId, @hardwareId, @isPerpetual, @expirationDate, @status, @createdAt)
    `).run({
        licenseKey: signedLicenseJson,
        softwareId: licenseData.softwareId,
        clientCompanyId: licenseData.clientCompanyId,
        hardwareId: licenseData.hardwareId,
        isPerpetual: licenseData.isPerpetual ? 1 : 0,
        expirationDate: licenseData.expirationDate,
        status: 'active',
        createdAt: licenseInfo.createdAt
    });

    return db.prepare('SELECT * FROM licenses WHERE id = ?').get(info.lastInsertRowid) as License;
}

export async function updateLicense(license: License): Promise<License> {
    const db = await connectLicensesDb();
    if (!license.hardwareId) throw new Error("El Hardware ID es obligatorio.");

    const licenseInfo = {
        softwareId: license.softwareId,
        clientCompanyId: license.clientCompanyId,
        hardwareId: license.hardwareId,
        isPerpetual: license.isPerpetual,
        expirationDate: license.expirationDate,
        createdAt: license.createdAt,
    };

    const signedLicenseJson = await signLicenseData(licenseInfo);
    db.prepare(`
        UPDATE licenses SET licenseKey = @licenseKey, softwareId = @softwareId, clientCompanyId = @clientCompanyId,
            hardwareId = @hardwareId, isPerpetual = @isPerpetual, expirationDate = @expirationDate, status = @status
        WHERE id = @id
    `).run({
        ...license,
        licenseKey: signedLicenseJson,
        isPerpetual: license.isPerpetual ? 1 : 0,
    });
    return db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id) as License;
}

export async function deleteLicense(id: number): Promise<void> {
    const db = await connectLicensesDb();
    db.prepare('DELETE FROM licenses WHERE id = ?').run(id);
}

export async function getSoftwareProducts(): Promise<SoftwareProduct[]> {
    const db = await connectLicensesDb();
    return db.prepare('SELECT * FROM software_products ORDER BY name').all() as SoftwareProduct[];
}

export async function addSoftwareProduct(product: Omit<SoftwareProduct, 'id'>): Promise<SoftwareProduct> {
    const db = await connectLicensesDb();
    const info = db.prepare(`INSERT INTO software_products (name, isInternal) VALUES (@name, @isInternal)`).run({ ...product, isInternal: product.isInternal ? 1 : 0 });
    return db.prepare('SELECT * FROM software_products WHERE id = ?').get(info.lastInsertRowid) as SoftwareProduct;
}

export async function deleteSoftwareProduct(id: number): Promise<void> {
    const db = await connectLicensesDb();
    db.prepare('DELETE FROM software_products WHERE id = ?').run(id);
}
