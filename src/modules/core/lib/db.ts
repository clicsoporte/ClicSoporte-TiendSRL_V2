/**
 * @fileoverview Main database initialization and shared utility functions.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from './db-connection';
import { initialUsers, initialRoles } from './db-constants';
import type { LogEntry, DateRange } from '@/modules/core/types';
import bcrypt from 'bcryptjs';
import { addLog as dbAddLog } from './logger-db';

const DB_FILE = 'intratool.db';
const SALT_ROUNDS = 10;

/**
 * Shared connection function for the main system database.
 */
export async function connectDb(dbFile: string = DB_FILE): Promise<Database> {
    if (dbFile === DB_FILE) {
        return baseConnectDb(DB_FILE, initializeMainDatabase, runMainMigrations);
    }
    // Fallback for other modules that still call this with a custom filename
    return baseConnectDb(dbFile);
}

export async function initializeMainDatabase(db: Database) {
    const mainSchema = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            whatsapp TEXT,
            avatar TEXT,
            role TEXT NOT NULL,
            recentActivity TEXT,
            securityQuestion TEXT,
            securityAnswer TEXT
        );

        CREATE TABLE IF NOT EXISTS user_preferences (
            id TEXT PRIMARY KEY,
            userId INTEGER NOT NULL,
            settingName TEXT NOT NULL,
            value TEXT NOT NULL
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

        CREATE TABLE IF NOT EXISTS exemption_laws (
            docType TEXT PRIMARY KEY,
            institutionName TEXT NOT NULL,
            authNumber TEXT
        );
        
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT
        );

        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY, name TEXT, address TEXT, phone TEXT, taxId TEXT, currency TEXT,
            creditLimit REAL, paymentCondition TEXT, salesperson TEXT, active TEXT, email TEXT, electronicDocEmail TEXT,
            supportPackageId TEXT, monthlyHoursBalance REAL, isManual BOOLEAN DEFAULT FALSE,
            contacts TEXT
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY, description TEXT, classification TEXT, lastEntry TEXT, active TEXT,
            notes TEXT, unit TEXT, isBasicGood TEXT, cabys TEXT
        );

        CREATE TABLE IF NOT EXISTS exemptions (
            code TEXT PRIMARY KEY, description TEXT, customer TEXT, authNumber TEXT, startDate TEXT,
            endDate TEXT, percentage REAL, docType TEXT, institutionName TEXT, institutionCode TEXT
        );

        CREATE TABLE IF NOT EXISTS stock (
            itemId TEXT PRIMARY KEY,
            stockByWarehouse TEXT NOT NULL,
            totalStock REAL NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS quote_drafts (
            id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, userId INTEGER, customerId TEXT,
            lines TEXT, totals TEXT, notes TEXT, currency TEXT, exchangeRate REAL, purchaseOrderNumber TEXT,
            customerDetails TEXT, deliveryAddress TEXT, deliveryDate TEXT, sellerName TEXT,
            sellerType TEXT, quoteDate TEXT, validUntilDate TEXT, paymentTerms TEXT, creditDays INTEGER
        );

        CREATE TABLE IF NOT EXISTS sql_config (
            key TEXT PRIMARY KEY, value TEXT
        );

        CREATE TABLE IF NOT EXISTS import_queries (
            type TEXT PRIMARY KEY, query TEXT
        );
        
        CREATE TABLE IF NOT EXISTS cabys_catalog (
            code TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            taxRate REAL
        );

        CREATE TABLE IF NOT EXISTS exchange_rates (
            date TEXT PRIMARY KEY,
            rate REAL NOT NULL
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
    const userInsert = db.prepare('INSERT OR IGNORE INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity, securityQuestion, securityAnswer) VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity, @securityQuestion, @securityAnswer)');
    initialUsers.forEach(user => {
        const hashedPassword = bcrypt.hashSync(user.password!, SALT_ROUNDS);
        userInsert.run({ ...user, password: hashedPassword });
    });

    const roleInsert = db.prepare('INSERT OR IGNORE INTO roles (id, name, permissions) VALUES (@id, @name, @permissions)');
    initialRoles.forEach(role => roleInsert.run({ ...role, permissions: JSON.stringify(role.permissions) }));
}

export async function runMainMigrations(db: Database) {
    // Check if contacts column exists in customers table
    const customersTableInfo = db.prepare(`PRAGMA table_info(customers)`).all() as { name: string }[];
    const customerColumns = new Set(customersTableInfo.map(c => c.name));

    if (!customerColumns.has('contacts')) {
        console.log("MIGRATION (intratool.db): Adding 'contacts' column to 'customers' table.");
        db.exec(`ALTER TABLE customers ADD COLUMN contacts TEXT;`);
    }
}

export async function getUserPreferences(userId: number, settingName: string): Promise<Record<string, unknown>> {
    const db = await connectDb();
    const prefId = `${userId}-${settingName}`;
    const row = db.prepare('SELECT value FROM user_preferences WHERE id = ?').get(prefId) as { value: string } | undefined;
    if (row) {
        return JSON.parse(row.value);
    }
    return {};
}

export async function saveUserPreferences(userId: number, settingName: string, value: unknown): Promise<void> {
    const db = await connectDb();
    const prefId = `${userId}-${settingName}`;
    db.prepare('INSERT OR REPLACE INTO user_preferences (id, userId, settingName, value) VALUES (?, ?, ?, ?)')
      .run(prefId, userId, settingName, JSON.stringify(value));
}

export async function getLogs(filters: {
    type?: 'operational' | 'system' | 'all';
    search?: string;
    dateRange?: DateRange;
} = {}): Promise<LogEntry[]> {
    const db = await connectDb();
    let query = 'SELECT * FROM logs';
    const params: (string | number)[] = [];
    const whereClauses: string[] = [];

    if (filters.type && filters.type !== 'all') {
        if (filters.type === 'operational') {
            whereClauses.push('type = ?');
            params.push('INFO');
        } else if (filters.type === 'system') {
            whereClauses.push('type IN (?, ?)');
            params.push('WARN', 'ERROR');
        }
    }
    
    if (filters.search) {
        whereClauses.push('(message LIKE ? OR details LIKE ?)');
        const likeTerm = `%${filters.search}%`;
        params.push(likeTerm, likeTerm);
    }
    
    if(filters.dateRange?.from) {
        whereClauses.push('timestamp >= ?');
        params.push(filters.dateRange.from.toISOString());
    }
     if(filters.dateRange?.to) {
        const toDate = new Date(filters.dateRange.to);
        toDate.setDate(toDate.getDate() + 1);
        whereClauses.push('timestamp < ?');
        params.push(toDate.toISOString());
    }

    if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ' ORDER BY timestamp DESC LIMIT 500';

    const logs = db.prepare(query).all(...params) as LogEntry[];
    return JSON.parse(JSON.stringify(logs));
}

export async function clearLogs(clearedBy: string, type: 'operational' | 'system' | 'all', deleteAllTime: boolean): Promise<void> {
    const db = await connectDb();
    
    let whereClause = '';
    const params: string[] = [];
    
    if (!deleteAllTime) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        whereClause += 'timestamp < ?';
        params.push(thirtyDaysAgo.toISOString());
    }

    if (type !== 'all') {
        if (whereClause) whereClause += ' AND ';
        if (type === 'operational') {
            whereClause += 'type = ?';
            params.push('INFO');
        } else if (type === 'system') {
            whereClause += 'type IN (?, ?)';
            params.push('WARN', 'ERROR');
        }
    }

    const query = `DELETE FROM logs ${whereClause ? 'WHERE ' + whereClause : ''}`;
    const info = db.prepare(query).run(...params);
    
    await dbAddLog({ type: "WARN", message: `Logs cleared by ${clearedBy}`, details: { type, deleteAllTime, affectedRows: info.changes } });
}
