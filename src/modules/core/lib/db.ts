/**
 * @fileoverview Main database initialization and shared utility functions.
 * Unified into a single source of truth: intratool.db
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from './db-connection';
import { initialUsers, initialRoles } from './db-constants';
import { COSTA_RICA_GEO_DATA } from './geo-seed-data';
import bcrypt from 'bcryptjs';
import type { LogEntry, DateRange } from '../types';

const DB_FILE = 'intratool.db';
const SALT_ROUNDS = 10;

/**
 * Connects to the central database.
 * All modules now point here.
 */
export async function connectDb(): Promise<Database> {
    return baseConnectDb(DB_FILE, initializeMainDatabase, runMainMigrations);
}

export async function initializeMainDatabase(db: Database) {
    const mainSchema = `
        -- CORE SYSTEM TABLES
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
            logoUrl TEXT, systemName TEXT, systemVersion TEXT, publicUrl TEXT,
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

        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            taxId TEXT NOT NULL,
            currency TEXT DEFAULT 'CRC',
            creditLimit REAL DEFAULT 0,
            paymentCondition TEXT DEFAULT '0',
            salesperson TEXT,
            active TEXT DEFAULT 'S',
            email TEXT,
            electronicDocEmail TEXT,
            isManual INTEGER DEFAULT 0,
            contacts TEXT,
            supportPackageId TEXT,
            taxRegime TEXT,
            taxStatus TEXT,
            isTaxMoroso INTEGER DEFAULT 0,
            isTaxOmiso INTEGER DEFAULT 0,
            taxAdministration TEXT,
            taxActivities TEXT,
            provinceId INTEGER,
            cantonId INTEGER,
            districtId INTEGER
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            classification TEXT,
            lastEntry TEXT,
            active TEXT DEFAULT 'S',
            notes TEXT,
            unit TEXT,
            isBasicGood TEXT DEFAULT 'N',
            cabys TEXT
        );

        CREATE TABLE IF NOT EXISTS stock (
            itemId TEXT PRIMARY KEY,
            stockByWarehouse TEXT,
            totalStock REAL,
            FOREIGN KEY (itemId) REFERENCES products(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS exemptions (
            code TEXT PRIMARY KEY,
            description TEXT,
            customer TEXT,
            authNumber TEXT,
            startDate TEXT,
            endDate TEXT,
            percentage REAL,
            docType TEXT,
            institutionName TEXT,
            institutionCode TEXT
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

        CREATE TABLE IF NOT EXISTS quote_drafts (
            id TEXT PRIMARY KEY,
            createdAt TEXT NOT NULL,
            userId INTEGER NOT NULL,
            customerId TEXT,
            customerDetails TEXT,
            lines TEXT,
            totals TEXT,
            notes TEXT,
            currency TEXT,
            exchangeRate REAL,
            purchaseOrderNumber TEXT,
            deliveryAddress TEXT,
            deliveryDate TEXT,
            sellerName TEXT,
            sellerType TEXT,
            quoteDate TEXT,
            validUntilDate TEXT,
            paymentTerms TEXT,
            creditDays INTEGER
        );

        -- CONTRACTS MODULE
        CREATE TABLE IF NOT EXISTS contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            customerId TEXT NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            includedServices TEXT NOT NULL,
            excludedServices TEXT NOT NULL,
            monthlyHours REAL DEFAULT 0,
            price REAL DEFAULT 0,
            currency TEXT DEFAULT 'CRC',
            notes TEXT,
            autoRenew INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contract_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- TICKETS MODULE
        CREATE TABLE IF NOT EXISTS client_companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            taxId TEXT UNIQUE NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS help_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            defaultPriority TEXT,
            defaultAssigneeId INTEGER,
            defaultServiceId TEXT
        );

        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            subject TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            dueDate TEXT,
            companyId INTEGER,
            customerName TEXT, 
            customerEmail TEXT,
            companyName TEXT,
            assigneeId INTEGER,
            helpTopicId INTEGER,
            serviceId TEXT,
            contractId INTEGER,
            isBillable INTEGER DEFAULT 0,
            providerId INTEGER
        );

        CREATE TABLE IF NOT EXISTS ticket_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketId INTEGER NOT NULL,
            userId INTEGER,
            userName TEXT,
            type TEXT NOT NULL,
            content TEXT,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ticket_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS third_party_providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            specialty TEXT,
            notes TEXT,
            contacts TEXT,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS provinces (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cantons (
            id INTEGER PRIMARY KEY,
            provinceId INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY (provinceId) REFERENCES provinces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS districts (
            id INTEGER PRIMARY KEY,
            cantonId INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY (cantonId) REFERENCES cantons(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS provider_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            providerId INTEGER NOT NULL,
            serviceId TEXT NOT NULL,
            buyPriceRemote REAL DEFAULT 0,
            marginRemote REAL DEFAULT 0,
            sellPriceRemote REAL DEFAULT 0,
            buyPriceOnSite REAL DEFAULT 0,
            marginOnSite REAL DEFAULT 0,
            sellPriceOnSite REAL DEFAULT 0,
            FOREIGN KEY (providerId) REFERENCES third_party_providers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS provider_geo_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            providerId INTEGER NOT NULL,
            provinceId INTEGER NOT NULL,
            cantonId INTEGER,
            districtId INTEGER,
            buyTravelPrice REAL DEFAULT 0,
            marginTravel REAL DEFAULT 0,
            sellTravelPrice REAL DEFAULT 0,
            locationName TEXT NOT NULL,
            FOREIGN KEY (providerId) REFERENCES third_party_providers(id) ON DELETE CASCADE
        );

        -- PLANNER MODULE
        CREATE TABLE IF NOT EXISTS planner_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            customerId TEXT NOT NULL,
            customerName TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'other',
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            coordinatorId INTEGER NOT NULL,
            subcontractorId INTEGER,
            description TEXT NOT NULL,
            notes TEXT,
            billingStatus TEXT DEFAULT 'pending',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_subcontractors (
            projectId INTEGER NOT NULL,
            providerId INTEGER NOT NULL,
            PRIMARY KEY (projectId, providerId),
            FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (providerId) REFERENCES third_party_providers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS project_advances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projectId INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            content TEXT NOT NULL,
            userId INTEGER NOT NULL,
            userName TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projectId INTEGER NOT NULL,
            name TEXT NOT NULL,
            fileName TEXT NOT NULL,
            fileType TEXT NOT NULL,
            data TEXT NOT NULL,
            uploadedBy TEXT NOT NULL,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projectId INTEGER NOT NULL,
            description TEXT NOT NULL,
            quantity REAL NOT NULL,
            unitPrice REAL NOT NULL,
            type TEXT NOT NULL
        );

        -- LICENSES MODULE
        CREATE TABLE IF NOT EXISTS software_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            isInternal BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            licenseKey TEXT NOT NULL,
            softwareId INTEGER NOT NULL,
            clientCompanyId INTEGER,
            hardwareId TEXT,
            isPerpetual BOOLEAN NOT NULL DEFAULT FALSE,
            expirationDate TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            createdAt TEXT NOT NULL
        );

        -- TIMESHEET MODULE
        CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            startTime TEXT NOT NULL,
            endTime TEXT,
            duration INTEGER,
            billableDuration INTEGER,
            billingStatus TEXT DEFAULT 'pending',
            externalInvoiceNumber TEXT,
            notes TEXT,
            isBillable BOOLEAN NOT NULL DEFAULT TRUE,
            createdAt TEXT NOT NULL
        );

        -- COST ASSISTANT MODULE
        CREATE TABLE IF NOT EXISTS cost_drafts (
            id TEXT PRIMARY KEY,
            userId INTEGER NOT NULL,
            name TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cost_assistant_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- NOTIFICATIONS MODULE
        CREATE TABLE IF NOT EXISTS notification_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            event TEXT NOT NULL,
            action TEXT NOT NULL,
            recipients TEXT NOT NULL,
            subject TEXT,
            enabled INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS notification_settings (
            service TEXT PRIMARY KEY,
            config TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            schedule TEXT NOT NULL,
            taskId TEXT NOT NULL,
            enabled INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            message TEXT NOT NULL,
            href TEXT,
            isRead INTEGER DEFAULT 0,
            timestamp TEXT NOT NULL,
            entityId INTEGER,
            entityType TEXT
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

    // Seed default settings for all modules
    db.prepare(`INSERT OR IGNORE INTO contract_settings (key, value) VALUES ('contractPrefix', 'CON-'), ('nextContractNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO ticket_settings (key, value) VALUES ('ticketPrefix', 'CAS-'), ('nextTicketNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('projectPrefix', 'PROJ-'), ('nextProjectNumber', '1'), ('pdfTopLegend', 'ACTA DE ENTREGA DE PROYECTO TI')`).run();
    db.prepare(`INSERT OR IGNORE INTO cost_assistant_settings (key, value) VALUES ('nextDraftNumber', '1'), ('draftPrefix', 'AC-')`).run();
    db.prepare(`INSERT OR IGNORE INTO notification_settings (service, config) VALUES ('telegram', ?)`).run(JSON.stringify({ botToken: '', chatId: '' }));

    // Seeding geographic data
    seedGeographicData(db);

    // Default Help Topics
    const topics = [
        { id: 1, name: 'Soporte General', defaultPriority: 'medium' },
        { id: 2, name: 'Consulta de Facturación', defaultPriority: 'medium' },
        { id: 3, name: 'Problema con Impresora', defaultPriority: 'high' }
    ];
    const insertTopic = db.prepare('INSERT OR IGNORE INTO help_topics (id, name, defaultPriority) VALUES (@id, @name, @defaultPriority)');
    topics.forEach(t => insertTopic.run(t));

    // Default Software Products
    const software = [
        { name: 'Clic-Soporte SaaS', isInternal: 1 },
        { name: 'Antivirus Kaspersky', isInternal: 0 },
        { name: 'Microsoft Office 365', isInternal: 0 }
    ];
    const insertSoftware = db.prepare('INSERT OR IGNORE INTO software_products (name, isInternal) VALUES (@name, @isInternal)');
    software.forEach(p => insertSoftware.run(p));
}

/**
 * Robust seeding function for geographic data.
 * Overwrites official names but preserves hierarchical integrity.
 */
function seedGeographicData(db: Database) {
    const insertProv = db.prepare('INSERT OR REPLACE INTO provinces (id, name) VALUES (?, ?)');
    const insertCant = db.prepare('INSERT OR REPLACE INTO cantons (id, provinceId, name) VALUES (?, ?, ?)');
    const insertDist = db.prepare('INSERT OR REPLACE INTO districts (id, cantonId, name) VALUES (?, ?, ?)');

    db.transaction(() => {
        for (const [pId, pData] of Object.entries(COSTA_RICA_GEO_DATA.provincias)) {
            const provinceId = parseInt(pId, 10);
            insertProv.run(provinceId, pData.nombre);

            for (const [cId, cData] of Object.entries(pData.cantones)) {
                // Stable unique ID for cantons: ProvinceID + Code
                const cantonId = provinceId * 100 + parseInt(cId, 10);
                insertCant.run(cantonId, provinceId, cData.nombre);

                for (const [dId, dName] of Object.entries(cData.distritos)) {
                    // Stable unique ID for districts: CantonID + Code
                    const districtId = cantonId * 100 + parseInt(dId, 10);
                    insertDist.run(districtId, cantonId, dName);
                }
            }
        }
    })();
}

export async function runMainMigrations(db: Database) {
    const tableInfo = (table: string) => db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    const hasColumn = (table: string, col: string) => new Set(tableInfo(table).map(c => c.name)).has(col);

    // Ensure geo data is always up to date with the latest official file
    seedGeographicData(db);

    // CORE Migrations
    if (!hasColumn('users', 'forcePasswordChange')) db.exec(`ALTER TABLE users ADD COLUMN forcePasswordChange INTEGER DEFAULT 0;`);
    if (!hasColumn('company_settings', 'systemVersion')) db.exec(`ALTER TABLE company_settings ADD COLUMN systemVersion TEXT;`);
    if (!hasColumn('company_settings', 'publicUrl')) db.exec(`ALTER TABLE company_settings ADD COLUMN publicUrl TEXT;`);

    // HACIENDA Migrations
    const haciendaFields = [
        ['taxRegime', 'TEXT'], ['taxStatus', 'TEXT'], ['isTaxMoroso', 'INTEGER DEFAULT 0'],
        ['isTaxOmiso', 'INTEGER DEFAULT 0'], ['taxAdministration', 'TEXT'], ['taxActivities', 'TEXT']
    ];
    haciendaFields.forEach(([field, type]) => {
        if (!hasColumn('customers', field)) db.exec(`ALTER TABLE customers ADD COLUMN ${field} ${type};`);
    });

    // CUSTOMER GEOGRAPHIC Migrations
    const geoFields = [
        ['provinceId', 'INTEGER'], ['cantonId', 'INTEGER'], ['districtId', 'INTEGER']
    ];
    geoFields.forEach(([field, type]) => {
        if (!hasColumn('customers', field)) db.exec(`ALTER TABLE customers ADD COLUMN ${field} ${type};`);
    });

    // TICKETS Migrations
    const ticketFields = [
        ['companyName', 'TEXT'], ['helpTopicId', 'INTEGER'], ['serviceId', 'TEXT'],
        ['dueDate', 'TEXT'], ['contractId', 'INTEGER'], ['isBillable', 'INTEGER DEFAULT 0'],
        ['providerId', 'INTEGER']
    ];
    ticketFields.forEach(([field, type]) => {
        if (!hasColumn('tickets', field)) db.exec(`ALTER TABLE tickets ADD COLUMN ${field} ${type};`);
    });

    // TIMESHEET Migrations
    if (!hasColumn('time_entries', 'billableDuration')) db.exec(`ALTER TABLE time_entries ADD COLUMN billableDuration INTEGER;`);
    if (!hasColumn('time_entries', 'billingStatus')) db.exec(`ALTER TABLE time_entries ADD COLUMN billingStatus TEXT DEFAULT 'pending';`);
    if (!hasColumn('time_entries', 'externalInvoiceNumber')) db.exec(`ALTER TABLE time_entries ADD COLUMN externalInvoiceNumber TEXT;`);

    // CUSTOMERS Migrations
    if (!hasColumn('customers', 'supportPackageId')) db.exec(`ALTER TABLE customers ADD COLUMN supportPackageId TEXT;`);

    // PLANNER Migrations
    if (!hasColumn('projects', 'category')) db.exec(`ALTER TABLE projects ADD COLUMN category TEXT NOT NULL DEFAULT 'other';`);
    
    // LICENSES Migrations
    if (!hasColumn('licenses', 'hardwareId')) db.exec(`ALTER TABLE licenses ADD COLUMN hardwareId TEXT;`);

    // PROVIDERS Migrations
    if (!hasColumn('third_party_providers', 'contacts')) db.exec(`ALTER TABLE third_party_providers ADD COLUMN contacts TEXT;`);

    // PROVIDER PRICING Migrations
    const providerServiceFields = [
        ['buyPriceRemote', 'REAL DEFAULT 0'], ['marginRemote', 'REAL DEFAULT 0'], ['sellPriceRemote', 'REAL DEFAULT 0'],
        ['buyPriceOnSite', 'REAL DEFAULT 0'], ['marginOnSite', 'REAL DEFAULT 0'], ['sellPriceOnSite', 'REAL DEFAULT 0']
    ];
    providerServiceFields.forEach(([field, type]) => {
        if (!hasColumn('provider_services', field)) db.exec(`ALTER TABLE provider_services ADD COLUMN ${field} ${type};`);
    });

    const providerGeoFields = [
        ['buyTravelPrice', 'REAL DEFAULT 0'], ['marginTravel', 'REAL DEFAULT 0'], ['sellTravelPrice', 'REAL DEFAULT 0']
    ];
    providerGeoFields.forEach(([field, type]) => {
        if (!hasColumn('provider_geo_rates', field)) db.exec(`ALTER TABLE provider_geo_rates ADD COLUMN ${field} ${type};`);
    });

    // New M-M table for subcontractors
    db.exec(`
        CREATE TABLE IF NOT EXISTS project_subcontractors (
            projectId INTEGER NOT NULL,
            providerId INTEGER NOT NULL,
            PRIMARY KEY (projectId, providerId),
            FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (providerId) REFERENCES third_party_providers(id) ON DELETE CASCADE
        );
    `);

    // Provider Intelligence Tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS provider_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            providerId INTEGER NOT NULL,
            serviceId TEXT NOT NULL,
            buyPriceRemote REAL DEFAULT 0,
            marginRemote REAL DEFAULT 0,
            sellPriceRemote REAL DEFAULT 0,
            buyPriceOnSite REAL DEFAULT 0,
            marginOnSite REAL DEFAULT 0,
            sellPriceOnSite REAL DEFAULT 0,
            FOREIGN KEY (providerId) REFERENCES third_party_providers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS provinces (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cantons (
            id INTEGER PRIMARY KEY,
            provinceId INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY (provinceId) REFERENCES provinces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS districts (
            id INTEGER PRIMARY KEY,
            cantonId INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY (cantonId) REFERENCES cantons(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS provider_geo_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            providerId INTEGER NOT NULL,
            provinceId INTEGER NOT NULL,
            cantonId INTEGER,
            districtId INTEGER,
            buyTravelPrice REAL DEFAULT 0,
            marginTravel REAL DEFAULT 0,
            sellTravelPrice REAL DEFAULT 0,
            locationName TEXT NOT NULL,
            FOREIGN KEY (providerId) REFERENCES third_party_providers(id) ON DELETE CASCADE
        );
    `);
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

export async function clearLogs(clearedBy: string, type: string, deleteAllTime: boolean) {
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

export async function getUnreadSuggestionsCount(): Promise<number> {
    const db = await connectDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM suggestions WHERE isRead = 0').get() as { count: number };
    return result.count;
}
