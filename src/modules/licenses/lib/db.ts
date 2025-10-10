/**
 * @fileoverview Server-side functions for the licenses database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { License, SoftwareProduct } from '@/modules/core/types';
import { signLicenseData } from './crypto';

const LICENSES_DB_FILE = 'licenses.db';

export async function initializeLicensesDb(db: import('better-sqlite3').Database): Promise<void> {
    const schema = `
        CREATE TABLE IF NOT EXISTS software_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            isInternal BOOLEAN NOT NULL DEFAULT FALSE -- TRUE for our SaaS, FALSE for third-party
        );

        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            licenseKey TEXT NOT NULL, -- Now stores the downloadable JSON license content
            softwareId INTEGER NOT NULL,
            clientCompanyId INTEGER,
            hardwareId TEXT,
            isPerpetual BOOLEAN NOT NULL DEFAULT FALSE,
            expirationDate TEXT,
            status TEXT NOT NULL DEFAULT 'active', -- active, expired, revoked
            createdAt TEXT NOT NULL,
            FOREIGN KEY (softwareId) REFERENCES software_products(id) ON DELETE CASCADE
        );
    `;
    db.exec(schema);

    // Insert default software products
    const defaultProducts = [
        { name: 'Clic-Soporte SaaS', isInternal: true },
        { name: 'Antivirus Kaspersky', isInternal: false },
        { name: 'Microsoft Office 365', isInternal: false },
        { name: 'Clic-Cola', isInternal: true },
    ];
    const insertTopic = db.prepare('INSERT OR IGNORE INTO software_products (name, isInternal) VALUES (@name, @isInternal)');
    defaultProducts.forEach(p => insertTopic.run({ ...p, isInternal: p.isInternal ? 1 : 0 }));

    console.log(`Database ${LICENSES_DB_FILE} initialized for License Management.`);
    await runLicensesMigrations(db);
}

export async function runLicensesMigrations(db: import('better-sqlite3').Database) {
    const licensesTableInfo = db.prepare(`PRAGMA table_info(licenses)`).all() as { name: string }[];
    const licensesColumns = new Set(licensesTableInfo.map(c => c.name));

    if (!licensesColumns.has('hardwareId')) {
        db.exec(`ALTER TABLE licenses ADD COLUMN hardwareId TEXT;`);
    }
}


// --- License Actions ---
export async function getLicenses(): Promise<License[]> {
    const db = await connectDb(LICENSES_DB_FILE);
    const results = db.prepare('SELECT * FROM licenses ORDER BY createdAt DESC').all() as License[];
    return JSON.parse(JSON.stringify(results));
}

export async function addLicense(licenseData: Omit<License, 'id' | 'createdAt' | 'licenseKey'>): Promise<License> {
    const db = await connectDb(LICENSES_DB_FILE);
    
    if (!licenseData.hardwareId) {
        throw new Error("El Hardware ID es obligatorio para generar una licencia offline.");
    }
    
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

    const result = db.prepare('SELECT * FROM licenses WHERE id = ?').get(info.lastInsertRowid) as License;
    return JSON.parse(JSON.stringify(result));
}

export async function updateLicense(license: License): Promise<License> {
    const db = await connectDb(LICENSES_DB_FILE);

    if (!license.hardwareId) {
        throw new Error("El Hardware ID es obligatorio para generar una licencia offline.");
    }

    const licenseInfo = {
        softwareId: license.softwareId,
        clientCompanyId: license.clientCompanyId,
        hardwareId: license.hardwareId,
        isPerpetual: license.isPerpetual,
        expirationDate: license.expirationDate,
        createdAt: license.createdAt, // Preserve original creation date on update
    };

    const signedLicenseJson = await signLicenseData(licenseInfo);
    
    db.prepare(`
        UPDATE licenses SET
            licenseKey = @licenseKey,
            softwareId = @softwareId,
            clientCompanyId = @clientCompanyId,
            hardwareId = @hardwareId,
            isPerpetual = @isPerpetual,
            expirationDate = @expirationDate,
            status = @status
        WHERE id = @id
    `).run({
        ...license,
        licenseKey: signedLicenseJson,
        hardwareId: license.hardwareId || null,
        isPerpetual: license.isPerpetual ? 1 : 0,
    });
    const result = db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id) as License;
    return JSON.parse(JSON.stringify(result));
}

export async function deleteLicense(id: number): Promise<void> {
    const db = await connectDb(LICENSES_DB_FILE);
    db.prepare('DELETE FROM licenses WHERE id = ?').run(id);
}

// --- Software Product Actions ---
export async function getSoftwareProducts(): Promise<SoftwareProduct[]> {
    const db = await connectDb(LICENSES_DB_FILE);
    const results = db.prepare('SELECT * FROM software_products ORDER BY name').all() as SoftwareProduct[];
    return JSON.parse(JSON.stringify(results));
}

export async function addSoftwareProduct(product: Omit<SoftwareProduct, 'id'>): Promise<SoftwareProduct> {
    const db = await connectDb(LICENSES_DB_FILE);
    const info = db.prepare(`
        INSERT INTO software_products (name, isInternal) VALUES (@name, @isInternal)
    `).run({ ...product, isInternal: product.isInternal ? 1 : 0 });
    const result = db.prepare('SELECT * FROM software_products WHERE id = ?').get(info.lastInsertRowid) as SoftwareProduct;
    return JSON.parse(JSON.stringify(result));
}

export async function deleteSoftwareProduct(id: number): Promise<void> {
    const db = await connectDb(LICENSES_DB_FILE);
    db.prepare('DELETE FROM software_products WHERE id = ?').run(id);
}
