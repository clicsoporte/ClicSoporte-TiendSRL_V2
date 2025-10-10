/**
 * @fileoverview Server-side functions for the licenses database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { License, SoftwareProduct } from '@/modules/core/types';
import crypto from 'crypto';

const LICENSES_DB_FILE = 'licenses.db';

export async function initializeLicensesDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS software_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            isInternal BOOLEAN NOT NULL DEFAULT FALSE -- TRUE for our SaaS, FALSE for third-party
        );

        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            licenseKey TEXT NOT NULL UNIQUE,
            softwareId INTEGER NOT NULL,
            clientCompanyId INTEGER,
            isPerpetual BOOLEAN NOT NULL DEFAULT FALSE,
            expirationDate TEXT,
            status TEXT NOT NULL DEFAULT 'active', -- active, expired, revoked
            createdAt TEXT NOT NULL,
            FOREIGN KEY (softwareId) REFERENCES software_products(id) ON DELETE CASCADE
            -- clientCompanyId could be a foreign key to tickets.db's client_companies if we wanted tight coupling
        );
    `;
    db.exec(schema);

    // Insert default software products
    const defaultProducts = [
        { name: 'Clic-Soporte SaaS', isInternal: true },
        { name: 'Antivirus Kaspersky', isInternal: false },
        { name: 'Microsoft Office 365', isInternal: false },
    ];
    const insert = db.prepare('INSERT OR IGNORE INTO software_products (name, isInternal) VALUES (@name, @isInternal)');
    defaultProducts.forEach(p => insert.run({ ...p, isInternal: p.isInternal ? 1 : 0 }));

    console.log(`Database ${LICENSES_DB_FILE} initialized for License Management.`);
    await runLicensesMigrations(db);
}

export async function runLicensesMigrations(db: import('better-sqlite3').Database) {
    // Future migrations for the licenses module can be added here.
}

function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return segments.join('-');
}

// --- License Actions ---
export async function getLicenses(): Promise<License[]> {
    const db = await connectDb(LICENSES_DB_FILE);
    const results = db.prepare('SELECT * FROM licenses ORDER BY createdAt DESC').all() as License[];
    return JSON.parse(JSON.stringify(results));
}

export async function addLicense(license: Omit<License, 'id' | 'createdAt'>): Promise<License> {
    const db = await connectDb(LICENSES_DB_FILE);
    
    const key = license.licenseKey || generateLicenseKey();

    const info = db.prepare(`
        INSERT INTO licenses (licenseKey, softwareId, clientCompanyId, isPerpetual, expirationDate, status, createdAt)
        VALUES (@licenseKey, @softwareId, @clientCompanyId, @isPerpetual, @expirationDate, @status, @createdAt)
    `).run({
        ...license,
        licenseKey: key,
        isPerpetual: license.isPerpetual ? 1 : 0,
        createdAt: new Date().toISOString(),
    });

    const result = db.prepare('SELECT * FROM licenses WHERE id = ?').get(info.lastInsertRowid) as License;
    return JSON.parse(JSON.stringify(result));
}

export async function updateLicense(license: License): Promise<License> {
    const db = await connectDb(LICENSES_DB_FILE);
    db.prepare(`
        UPDATE licenses SET
            licenseKey = @licenseKey,
            softwareId = @softwareId,
            clientCompanyId = @clientCompanyId,
            isPerpetual = @isPerpetual,
            expirationDate = @expirationDate,
            status = @status
        WHERE id = @id
    `).run({
        ...license,
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
