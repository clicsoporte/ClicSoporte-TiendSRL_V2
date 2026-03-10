/**
 * @fileoverview Main database initialization and shared utility functions.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from './db-connection';
import { initialUsers, initialRoles } from './db-constants';
import bcrypt from 'bcryptjs';

const DB_FILE = 'intratool.db';
const SALT_ROUNDS = 10;

export async function connectDb(dbFile: string = DB_FILE): Promise<Database> {
    if (dbFile === DB_FILE) {
        return baseConnectDb(DB_FILE, initializeMainDatabase, runMainMigrations);
    }
    return baseConnectDb(dbFile);
}

export async function initializeMainDatabase(db: Database) {
    const mainSchema = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            whatsapp TEXT,
            avatar TEXT,
            role TEXT NOT NULL,
            recentActivity TEXT,
            securityQuestion TEXT,
            securityAnswer TEXT,
            forcePasswordChange INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY, 
            name TEXT NOT NULL, 
            permissions TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS company_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            name TEXT, taxId TEXT, address TEXT, phone TEXT, email TEXT,
            logoUrl TEXT, systemName TEXT,
            quotePrefix TEXT, nextQuoteNumber INTEGER, decimalPlaces INTEGER, quoterShowTaxId BOOLEAN,
            searchDebounceTime INTEGER, syncWarningHours INTEGER, importMode TEXT, lastSyncTimestamp TEXT,
            customerFilePath TEXT, productFilePath TEXT, exemptionFilePath TEXT,
            stockFilePath TEXT, cabysFilePath TEXT,
            supportPackages TEXT, servicesCatalog TEXT
        );
        
        CREATE TABLE IF NOT EXISTS api_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            exchangeRateApi TEXT,
            haciendaExemptionApi TEXT,
            haciendaTributariaApi TEXT
        );

        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT
        );

        CREATE TABLE IF NOT EXISTS suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            userId INTEGER,
            userName TEXT,
            isRead INTEGER DEFAULT 0,
            timestamp TEXT NOT NULL
        );
    `;

    db.exec(mainSchema);

    // Initial data seeding
    const userInsert = db.prepare('INSERT OR IGNORE INTO users (id, name, email, password, phone, whatsapp, role, forcePasswordChange) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    initialUsers.forEach(user => {
        const hashedPassword = bcrypt.hashSync(user.password!, SALT_ROUNDS);
        userInsert.run(user.id, user.name, user.email, hashedPassword, user.phone, user.whatsapp, user.role, 0);
    });

    const roleInsert = db.prepare('INSERT OR IGNORE INTO roles (id, name, permissions) VALUES (?, ?, ?)');
    initialRoles.forEach(role => roleInsert.run(role.id, role.name, JSON.stringify(role.permissions)));
}

export async function runMainMigrations(db: Database) {
    const userTableInfo = db.prepare(`PRAGMA table_info(users)`).all() as { name: string }[];
    const userColumns = new Set(userTableInfo.map(c => c.name));

    if (!userColumns.has('forcePasswordChange')) {
        console.log("MIGRATION: Adding 'forcePasswordChange' to 'users' table.");
        db.exec(`ALTER TABLE users ADD COLUMN forcePasswordChange INTEGER DEFAULT 0;`);
    }
}
