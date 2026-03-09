/**
 * @fileoverview This file handles the SQLite database connection.
 * ALL FUNCTIONS IN THIS FILE ARE SERVER-ONLY.
 */
"use server";

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initialUsers, initialRoles, DB_MODULES } from './data';
import type { LogEntry, DateRange } from '@/modules/core/types';
import bcrypt from 'bcryptjs';
import { addLog as dbAddLog } from './logger-db';

const DB_FILE = 'intratool.db';
const SALT_ROUNDS = 10;

const dbDirectory = path.join(process.cwd(), 'dbs');
const dbConnections = new Map<string, Database.Database>();

/**
 * Establishes a connection to a specific SQLite database file.
 */
export async function connectDb(dbFile: string = DB_FILE): Promise<Database.Database> {
    if (dbConnections.has(dbFile) && dbConnections.get(dbFile)!.open) {
        return dbConnections.get(dbFile)!;
    }
    
    const dbPath = path.join(dbDirectory, dbFile);
    if (!fs.existsSync(dbDirectory)) {
        fs.mkdirSync(dbDirectory, { recursive: true });
    }

    const restoreFilePath = `${dbPath}_restore.db`;
    if (fs.existsSync(restoreFilePath)) {
        console.log(`Restore file found for ${dbFile}. Applying restore...`);
        try {
            if (dbConnections.has(dbFile) && dbConnections.get(dbFile)?.open) {
                dbConnections.get(dbFile)!.close();
                dbConnections.delete(dbFile);
            }
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, `${dbPath}.bak`);
                fs.unlinkSync(dbPath);
            }
            fs.renameSync(restoreFilePath, dbPath);
            await dbAddLog({ type: "WARN", message: `Database for module ${dbFile} was restored from a backup on startup.` });
        } catch(e: unknown) {
            console.error(`Failed to apply restore for ${dbFile}: ${(e as Error).message}`);
            if (fs.existsSync(restoreFilePath)) fs.unlinkSync(restoreFilePath);
        }
    }

    let db: Database.Database;
    let dbExistsAndIsValid = false;

    if (fs.existsSync(dbPath)) {
        try {
            db = new Database(dbPath);
            db.pragma('journal_mode = WAL');

            const moduleConfig = DB_MODULES.find(m => m.dbFile === dbFile);
            const mainTable = moduleConfig?.id === 'clic-tools-main' ? 'users' : moduleConfig?.id === 'purchase-requests' ? 'purchase_requests' : moduleConfig?.id === 'production-planner' ? 'production_orders' : moduleConfig?.id === 'cost-assistant' ? 'cost_analysis_drafts' : moduleConfig?.id === 'tickets' ? 'tickets' : moduleConfig?.id === 'licenses' ? 'licenses' : moduleConfig?.id === 'timesheet' ? 'time_entries' : null;
            
            if (mainTable) {
                const tableCheck = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(mainTable);
                if (tableCheck) {
                    dbExistsAndIsValid = true;
                }
            } else {
                dbExistsAndIsValid = true; 
            }
        } catch (error) {
            console.error(`Database ${dbFile} is corrupted. It will be re-initialized.`, error);
            if (dbConnections.has(dbFile) && dbConnections.get(dbFile)?.open) {
                dbConnections.get(dbFile)!.close();
            }
            if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
            dbExistsAndIsValid = false;
        }
    }

    if (!dbExistsAndIsValid) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        console.log(`Database ${dbFile} not found or corrupt, creating and initializing...`);
        const moduleConfig = DB_MODULES.find(m => m.dbFile === dbFile);
        if (moduleConfig?.initFn) {
            await moduleConfig.initFn(db);
        }
    }

    const moduleConfig = DB_MODULES.find(m => m.dbFile === dbFile);
    if (moduleConfig?.migrationFn) {
        try {
            await moduleConfig.migrationFn(db!);
        } catch (error) {
            console.error(`Migration failed for ${dbFile}:`, error);
        }
    }

    dbConnections.set(dbFile, db!);
    return db!;
}

export async function initializeMainDatabase(db: import('better-sqlite3').Database) {
    const mainSchema = `
        CREATE TABLE users (
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

        CREATE TABLE user_preferences (
            id TEXT PRIMARY KEY,
            userId INTEGER NOT NULL,
            settingName TEXT NOT NULL,
            value TEXT NOT NULL
        );

        CREATE TABLE company_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            name TEXT, taxId TEXT, address TEXT, phone TEXT, email TEXT,
            logoUrl TEXT, systemName TEXT,
            quotePrefix TEXT, nextQuoteNumber INTEGER, decimalPlaces INTEGER, quoterShowTaxId BOOLEAN,
            searchDebounceTime INTEGER, syncWarningHours INTEGER, importMode TEXT, lastSyncTimestamp TEXT,
            customerFilePath TEXT, productFilePath TEXT, exemptionFilePath TEXT,
            stockFilePath TEXT, cabysFilePath TEXT,
            supportPackages TEXT, servicesCatalog TEXT
        );
        
        CREATE TABLE api_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            exchangeRateApi TEXT,
            haciendaExemptionApi TEXT,
            haciendaTributariaApi TEXT
        );

        CREATE TABLE exemption_laws (
            docType TEXT PRIMARY KEY,
            institutionName TEXT NOT NULL,
            authNumber TEXT
        );
        
        CREATE TABLE logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT
        );

        CREATE TABLE customers (
            id TEXT PRIMARY KEY, name TEXT, address TEXT, phone TEXT, taxId TEXT, currency TEXT,
            creditLimit REAL, paymentCondition TEXT, salesperson TEXT, active TEXT, email TEXT, electronicDocEmail TEXT,
            supportPackageId TEXT, monthlyHoursBalance REAL
        );

        CREATE TABLE products (
            id TEXT PRIMARY KEY, description TEXT, classification TEXT, lastEntry TEXT, active TEXT,
            notes TEXT, unit TEXT, isBasicGood TEXT, cabys TEXT
        );

        CREATE TABLE exemptions (
            code TEXT PRIMARY KEY, description TEXT, customer TEXT, authNumber TEXT, startDate TEXT,
            endDate TEXT, percentage REAL, docType TEXT, institutionName TEXT, institutionCode TEXT
        );

        CREATE TABLE stock (
            itemId TEXT PRIMARY KEY,
            stockByWarehouse TEXT NOT NULL,
            totalStock REAL NOT NULL
        );
        
        CREATE TABLE stock_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE roles (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT NOT NULL
        );

        CREATE TABLE quote_drafts (
            id TEXT PRIMARY KEY, createdAt TEXT NOT NULL, userId INTEGER, customerId TEXT,
            lines TEXT, totals TEXT, notes TEXT, currency TEXT, exchangeRate REAL, purchaseOrderNumber TEXT,
            customerDetails TEXT, deliveryAddress TEXT, deliveryDate TEXT, sellerName TEXT,
            sellerType TEXT, quoteDate TEXT, validUntilDate TEXT, paymentTerms TEXT, creditDays INTEGER
        );

        CREATE TABLE sql_config (
            key TEXT PRIMARY KEY, value TEXT
        );

        CREATE TABLE import_queries (
            type TEXT PRIMARY KEY, query TEXT
        );
        
        CREATE TABLE cabys_catalog (
            code TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            taxRate REAL
        );

        CREATE TABLE exchange_rates (
            date TEXT PRIMARY KEY,
            rate REAL NOT NULL
        );

        CREATE TABLE suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            userId INTEGER,
            userName TEXT,
            isRead INTEGER DEFAULT 0,
            timestamp TEXT NOT NULL
        );
    `;

    db.exec(mainSchema);

    const userInsert = db.prepare('INSERT INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity, securityQuestion, securityAnswer) VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity, @securityQuestion, @securityAnswer)');
    initialUsers.forEach(user => {
        const hashedPassword = bcrypt.hashSync(user.password!, SALT_ROUNDS);
        userInsert.run({ ...user, password: hashedPassword });
    });

    const roleInsert = db.prepare('INSERT INTO roles (id, name, permissions) VALUES (@id, @name, @permissions)');
    initialRoles.forEach(role => roleInsert.run({ ...role, permissions: JSON.stringify(role.permissions) }));
    
    console.log(`Database ${DB_FILE} initialized.`);
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
