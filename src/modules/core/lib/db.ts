/**
 * @fileoverview Main database initialization and shared utility functions.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from './db-connection';
import { initialUsers, initialRoles } from './db-constants';
import bcrypt from 'bcryptjs';
import type { LogEntry, DateRange, Suggestion } from '../types';

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

        CREATE TABLE IF NOT EXISTS email_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
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

        CREATE TABLE IF NOT EXISTS user_preferences (
            userId INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (userId, key)
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
        db.exec(`ALTER TABLE users ADD COLUMN forcePasswordChange INTEGER DEFAULT 0;`);
    }

    const hasEmailSettings = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='email_settings'`).get();
    if (!hasEmailSettings) {
        db.exec(`
            CREATE TABLE email_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);
    }
}

export async function getLogs(filters: { type?: string; search?: string; dateRange?: DateRange }): Promise<LogEntry[]> {
    const db = await connectDb();
    let query = 'SELECT * FROM logs';
    const params: (string | number | null)[] = [];
    const conditions: string[] = [];

    if (filters.type && filters.type !== 'all') {
        if (filters.type === 'operational') conditions.push("type = 'INFO'");
        else conditions.push("type IN ('WARN', 'ERROR')");
    }

    if (filters.search) {
        conditions.push("(message LIKE ? OR details LIKE ?)");
        params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.dateRange?.from) {
        conditions.push("timestamp >= ?");
        params.push(filters.dateRange.from.toISOString());
    }

    if (filters.dateRange?.to) {
        conditions.push("timestamp <= ?");
        params.push(filters.dateRange.to.toISOString());
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY timestamp DESC LIMIT 500';

    const rows = db.prepare(query).all(...params) as LogEntry[];
    return rows.map(r => ({ ...r, details: r.details ? JSON.parse(String(r.details)) : undefined }));
}

export async function clearLogs(_clearedBy: string, type: string, deleteAllTime: boolean) {
    const db = await connectDb();
    const query = 'DELETE FROM logs';
    const conditions: string[] = [];
    if (type === 'operational') conditions.push("type = 'INFO'");
    else if (type === 'system') conditions.push("type IN ('WARN', 'ERROR')");

    if (!deleteAllTime) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        conditions.push("timestamp < ?");
        db.prepare(query + ' WHERE ' + conditions.join(' AND ')).run(thirtyDaysAgo.toISOString());
    } else {
        db.prepare(query + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '')).run();
    }
}

export async function getUserPreferences(userId: number, key: string): Promise<Record<string, unknown>> {
    const db = await connectDb();
    const row = db.prepare('SELECT value FROM user_preferences WHERE userId = ? AND key = ?').get(userId, key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : {};
}

export async function saveUserPreferences(userId: number, key: string, value: Record<string, unknown>): Promise<void> {
    const db = await connectDb();
    db.prepare('INSERT OR REPLACE INTO user_preferences (userId, key, value) VALUES (?, ?, ?)').run(userId, key, JSON.stringify(value));
}

export async function getUnreadSuggestions(): Promise<Suggestion[]> {
    const db = await connectDb();
    return db.prepare('SELECT * FROM suggestions WHERE isRead = 0 ORDER BY timestamp DESC').all() as Suggestion[];
}
