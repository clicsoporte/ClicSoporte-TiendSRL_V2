/**
 * @fileoverview This file handles the SQLite database connection and provides
 * server-side functions for all database operations. It includes initialization,
 * schema creation, data access, and migration logic for all application modules.
 * ALL FUNCTIONS IN THIS FILE ARE SERVER-ONLY.
 */
"use server";

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initialUsers, initialCompany, initialRoles } from './data';
import type { Company, LogEntry, ApiSettings, User, Product, Customer, Role, QuoteDraft, DatabaseModule, Exemption, ExemptionLaw, StockInfo, Warehouse, StockSettings, Location, InventoryItem, SqlConfig, ImportQuery, ItemLocation, UpdateBackupInfo, DateRange, CostAnalysisDraft } from '@/modules/core/types';
import bcrypt from 'bcryptjs';
import Papa from 'papaparse';
import { executeQuery } from './sql-service';
import { initializePlannerDb, runPlannerMigrations } from '../../planner/lib/db';
import { initializeRequestsDb, runRequestMigrations } from '../../requests/lib/db';
import { initializeWarehouseDb, runWarehouseMigrations } from '../../warehouse/lib/db';
import { initializeCostAssistantDb, runCostAssistantMigrations } from '../../cost-assistant/lib/db';
import { initializeTicketsDb, runTicketMigrations } from '../../tickets/lib/db';
import { initializeLicensesDb, runLicensesMigrations } from '../../licenses/lib/db';
import { getExchangeRate as fetchExchangeRateFromApi } from '../lib/api-actions';
import { getSqlConfig } from './config-db';
import { addLog as dbAddLog } from './logger-db';


const DB_FILE = 'intratool.db';
const SALT_ROUNDS = 10;
const CABYS_FILE_PATH = path.join(process.cwd(), 'docs', 'Datos', 'cabys.csv');
const UPDATE_BACKUP_DIR = 'update_backups';


/**
 * Acts as a registry for all database modules in the application.
 * This structure allows the core `connectDb` function to be completely agnostic
 * of any specific module, promoting true modularity and decoupling.
 */
const DB_MODULES: DatabaseModule[] = [
    { id: 'clic-tools-main', name: 'Clic-Tools (Sistema Principal)', dbFile: DB_FILE, initFn: initializeMainDatabase, migrationFn: checkAndApplyMigrations },
    { id: 'purchase-requests', name: 'Solicitud de Compra', dbFile: 'requests.db', initFn: initializeRequestsDb, migrationFn: runRequestMigrations },
    { id: 'production-planner', name: 'Gestor de Proyectos', dbFile: 'planner.db', initFn: initializePlannerDb, migrationFn: runPlannerMigrations },
    { id: 'warehouse-management', name: 'Gestión de Almacenes', dbFile: 'warehouse.db', initFn: initializeWarehouseDb, migrationFn: runWarehouseMigrations },
    { id: 'cost-assistant', name: 'Asistente de Costos', dbFile: 'cost-assistant.db', initFn: initializeCostAssistantDb, migrationFn: runCostAssistantMigrations },
    { id: 'tickets', name: 'Soporte Técnico', dbFile: 'tickets.db', initFn: initializeTicketsDb, migrationFn: runTicketMigrations },
    { id: 'licenses', name: 'Gestión de Licencias', dbFile: 'licenses.db', initFn: initializeLicensesDb, migrationFn: runLicensesMigrations },
];

// This path is configured to work correctly within the Next.js build output directory,
// which is crucial for serverless environments.
const dbDirectory = path.join(process.cwd(), 'dbs');

let dbConnections = new Map<string, Database.Database>();

/**
 * Establishes a connection to a specific SQLite database file.
 * If the database file does not exist or is malformed, it creates it and initializes the schema and default data.
 * It manages multiple connections in a map to support a multi-database architecture.
 * @param {string} dbFile - The filename of the database to connect to.
 * @returns {Database.Database} The database connection instance.
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
                fs.copyFileSync(dbPath, `${dbPath}.bak`); // Create a .bak before overwriting
                fs.unlinkSync(dbPath);
            }
            fs.renameSync(restoreFilePath, dbPath);
            await dbAddLog({ type: "WARN", message: `Database for module ${dbFile} was restored from a backup on startup.` });
        } catch(e: any) {
            console.error(`Failed to apply restore for ${dbFile}: ${e.message}`);
            await dbAddLog({ type: "ERROR", message: `Failed to apply restore for ${dbFile}`, details: { error: e.message } });
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
            const mainTable = moduleConfig?.id === 'clic-tools-main' ? 'users' : moduleConfig?.id === 'purchase-requests' ? 'purchase_requests' : moduleConfig?.id === 'production-planner' ? 'production_orders' : moduleConfig?.id === 'warehouse-management' ? 'locations' : moduleConfig?.id === 'cost-assistant' ? 'cost_analysis_drafts' : moduleConfig?.id === 'tickets' ? 'tickets' : moduleConfig?.id === 'licenses' ? 'licenses' : null;
            
            if (mainTable) {
                const tableCheck = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(mainTable);
                if (tableCheck) {
                    dbExistsAndIsValid = true;
                } else {
                     console.log(`Main table '${mainTable}' not found in ${dbFile}. DB will be re-initialized.`);
                }
            } else {
                // If we don't have a main table to check, assume it's valid if it opens.
                // This is a fallback and less safe.
                dbExistsAndIsValid = true; 
            }
        } catch (error) {
            console.error(`Database ${dbFile} is corrupted or unreadable. It will be re-initialized.`, error);
            if (dbConnections.has(dbFile) && dbConnections.get(dbFile)?.open) {
                dbConnections.get(dbFile)!.close();
            }
            fs.unlinkSync(dbPath);
            dbExistsAndIsValid = false;
        }
    }


    if (!dbExistsAndIsValid) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        console.log(`Database ${dbFile} not found or seems empty/corrupt, creating and initializing...`);
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
            console.error(`Migration failed for ${dbFile}, but continuing. Error:`, error);
        }
    }

    dbConnections.set(dbFile, db!);
    return db!;
}


/**
 * Checks the database schema and applies necessary alterations (migrations).
 * This makes the app more resilient to schema changes over time without data loss.
 * @param {Database.Database} db - The database instance to check.
 */
async function checkAndApplyMigrations(db: import('better-sqlite3').Database) {
    // Main DB Migrations
    try {
        const companyTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='company_settings'`).get();
        if(!companyTable) return; // DB not initialized yet, migrations will fail.
        
        const companyTableInfo = db.prepare(`PRAGMA table_info(company_settings)`).all() as { name: string }[];
        const companyColumns = new Set(companyTableInfo.map(c => c.name));
        
        if (!companyColumns.has('decimalPlaces')) {
            console.log("MIGRATION: Adding decimalPlaces column to company_settings.");
            db.exec(`ALTER TABLE company_settings ADD COLUMN decimalPlaces INTEGER DEFAULT 2`);
        }
        
        if (companyColumns.has('importPath')) {
            console.log("MIGRATION: Dropping importPath column from company_settings.");
            db.exec(`ALTER TABLE company_settings DROP COLUMN importPath`);
        }
        
        if (!companyColumns.has('customerFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN customerFilePath TEXT`);
        if (!companyColumns.has('productFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN productFilePath TEXT`);
        if (!companyColumns.has('exemptionFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN exemptionFilePath TEXT`);
        if (!companyColumns.has('stockFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN stockFilePath TEXT`);
        if (!companyColumns.has('locationFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN locationFilePath TEXT`);
        if (!companyColumns.has('cabysFilePath')) db.exec(`ALTER TABLE company_settings ADD COLUMN cabysFilePath TEXT`);
        if (!companyColumns.has('importMode')) db.exec(`ALTER TABLE company_settings ADD COLUMN importMode TEXT DEFAULT 'file'`);
        if (!companyColumns.has('logoUrl')) db.exec(`ALTER TABLE company_settings ADD COLUMN logoUrl TEXT`);
        if (!companyColumns.has('searchDebounceTime')) db.exec(`ALTER TABLE company_settings ADD COLUMN searchDebounceTime INTEGER DEFAULT 500`);
        if (!companyColumns.has('lastSyncTimestamp')) db.exec(`ALTER TABLE company_settings ADD COLUMN lastSyncTimestamp TEXT`);
        if (!companyColumns.has('syncWarningHours')) db.exec(`ALTER TABLE company_settings ADD COLUMN syncWarningHours INTEGER DEFAULT 12`);
        if (!companyColumns.has('quoterShowTaxId')) db.exec(`ALTER TABLE company_settings ADD COLUMN quoterShowTaxId BOOLEAN DEFAULT TRUE`);
        if (!companyColumns.has('supportPackages')) db.exec(`ALTER TABLE company_settings ADD COLUMN supportPackages TEXT`);
        if (!companyColumns.has('servicesCatalog')) db.exec(`ALTER TABLE company_settings ADD COLUMN servicesCatalog TEXT`);


        const adminUser = db.prepare('SELECT role FROM users WHERE id = 1').get() as { role: string } | undefined;
        if (adminUser && adminUser.role !== 'admin') {
            console.log("MIGRATION: Ensuring user with ID 1 is an admin.");
            db.prepare(`UPDATE users SET role = 'admin' WHERE id = 1`).run();
        }

        const draftsTableInfo = db.prepare(`PRAGMA table_info(quote_drafts)`).all() as { name: string }[];
        const draftColumns = new Set(draftsTableInfo.map(c => c.name));
        if (!draftColumns.has('userId')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN userId INTEGER;`);
        if (!draftColumns.has('customerId')) {
            db.exec(`ALTER TABLE quote_drafts ADD COLUMN customerId TEXT;`);
            
            const oldDrafts = db.prepare('SELECT id, customer FROM quote_drafts WHERE customer IS NOT NULL').all() as {id: string, customer: string}[];
            for(const draft of oldDrafts) {
                try {
                    const customerObj = JSON.parse(draft.customer);
                    if (customerObj && customerObj.id) {
                        db.prepare('UPDATE quote_drafts SET customerId = ? WHERE id = ?').run(customerObj.id, draft.id);
                    }
                } catch {}
            }
        }
        if (!draftColumns.has('lines')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN lines TEXT;`);
        if (!draftColumns.has('totals')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN totals TEXT;`);
        if (!draftColumns.has('notes')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN notes TEXT;`);
        if (!draftColumns.has('currency')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN currency TEXT;`);
        if (!draftColumns.has('exchangeRate')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN exchangeRate REAL;`);
        if (!draftColumns.has('purchaseOrderNumber')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN purchaseOrderNumber TEXT;`);
        if (!draftColumns.has('customerDetails')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN customerDetails TEXT;`);
        if (!draftColumns.has('deliveryAddress')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN deliveryAddress TEXT;`);
        if (!draftColumns.has('deliveryDate')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN deliveryDate TEXT;`);
        if (!draftColumns.has('sellerName')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN sellerName TEXT;`);
        if (!draftColumns.has('sellerType')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN sellerType TEXT;`);
        if (!draftColumns.has('quoteDate')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN quoteDate TEXT;`);
        if (!draftColumns.has('validUntilDate')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN validUntilDate TEXT;`);
        if (!draftColumns.has('paymentTerms')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN paymentTerms TEXT;`);
        if (!draftColumns.has('creditDays')) db.exec(`ALTER TABLE quote_drafts ADD COLUMN creditDays INTEGER;`);
        
        const customerTableInfo = db.prepare(`PRAGMA table_info(customers)`).all() as { name: string }[];
        const customerColumns = new Set(customerTableInfo.map(c => c.name));
        if (!customerColumns.has('supportPackageId')) db.exec(`ALTER TABLE customers ADD COLUMN supportPackageId TEXT`);
        if (!customerColumns.has('monthlyHoursBalance')) db.exec(`ALTER TABLE customers ADD COLUMN monthlyHoursBalance REAL`);


        const usersToUpdate = db.prepare('SELECT id, password FROM users').all() as User[];
        const updateUserPassword = db.prepare('UPDATE users SET password = ? WHERE id = ?');
        let updatedCount = 0;
        for (const user of usersToUpdate) {
            if (user.password && !user.password.startsWith('$2a$')) {
                const hashedPassword = bcrypt.hashSync(user.password, SALT_ROUNDS);
                updateUserPassword.run(hashedPassword, user.id);
                updatedCount++;
            }
        }
        if (updatedCount > 0) {
            console.log(`MIGRATION: Successfully hashed ${updatedCount} plaintext password(s).`);
        }

        const exemptionsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='exemptions'`).get();
        if (!exemptionsTable) {
            console.log("MIGRATION: Creating exemptions table.");
            db.exec(`
                CREATE TABLE exemptions (
                    code TEXT PRIMARY KEY, description TEXT, customer TEXT, authNumber TEXT, startDate TEXT, endDate TEXT, percentage REAL, docType TEXT,
                    institutionName TEXT, institutionCode TEXT
                );
            `);
        }
        
        const apiTableInfo = db.prepare(`PRAGMA table_info(api_settings)`).all() as { name: string }[];
        if (!apiTableInfo.some(col => col.name === 'haciendaExemptionApi')) {
            console.log("MIGRATION: Adding haciendaExemptionApi column to api_settings.");
            db.exec(`ALTER TABLE api_settings ADD COLUMN haciendaExemptionApi TEXT`);
        }
        if (!apiTableInfo.some(col => col.name === 'haciendaTributariaApi')) {
            console.log("MIGRATION: Adding haciendaTributariaApi column to api_settings.");
            db.exec(`ALTER TABLE api_settings ADD COLUMN haciendaTributariaApi TEXT`);
        }
        
        const lawsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='exemption_laws'`).get();
        if (!lawsTable) {
             console.log("MIGRATION: Creating exemption_laws table.");
             db.exec(`CREATE TABLE exemption_laws (docType TEXT PRIMARY KEY, institutionName TEXT NOT NULL, authNumber TEXT)`);
        }

        if (apiTableInfo.some(col => col.name === 'zonaFrancaLaw')) {
             console.log("MIGRATION: Dropping zonaFrancaLaw column from api_settings.");
             db.exec(`
                CREATE TABLE api_settings_new (id INTEGER PRIMARY KEY DEFAULT 1, exchangeRateApi TEXT, haciendaExemptionApi TEXT, haciendaTributariaApi TEXT);
                INSERT INTO api_settings_new (id, exchangeRateApi, haciendaExemptionApi, haciendaTributariaApi) SELECT id, exchangeRateApi, haciendaExemptionApi, haciendaTributariaApi FROM api_settings;
                DROP TABLE api_settings;
                ALTER TABLE api_settings_new RENAME TO api_settings;
             `);
        }

        const stockTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='stock'`).get();
        if (!stockTable) {
            console.log("MIGRATION: Creating stock table.");
            db.exec(`CREATE TABLE IF NOT EXISTS stock (itemId TEXT PRIMARY KEY, stockByWarehouse TEXT NOT NULL, totalStock REAL NOT NULL);`);
        }

        const stockSettingsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='stock_settings'`).get();
         if (!stockSettingsTable) {
            console.log("MIGRATION: Creating stock_settings table.");
            db.exec(`CREATE TABLE IF NOT EXISTS stock_settings (key TEXT PRIMARY KEY, value TEXT);`);
            const oldStockSettings = db.prepare("SELECT value FROM company_settings WHERE key = 'stockSettings'").get() as { value: string } | undefined;
            if (oldStockSettings) {
                console.log("MIGRATION: Moving stock settings to new table.");
                db.prepare("INSERT INTO stock_settings (key, value) VALUES ('warehouses', ?)").run(oldStockSettings.value);
                db.prepare("DELETE FROM company_settings WHERE key = 'stockSettings'").run();
            }
        }
        
        const sqlConfigTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='sql_config'`).get();
        if (!sqlConfigTable) {
            console.log("MIGRATION: Creating sql_config table.");
            db.exec(`CREATE TABLE IF NOT EXISTS sql_config (key TEXT PRIMARY KEY, value TEXT);`);
        }
        
        const importQueriesTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='import_queries'`).get();
        if (!importQueriesTable) {
            console.log("MIGRATION: Creating import_queries table.");
            db.exec(`CREATE TABLE IF NOT EXISTS import_queries (type TEXT PRIMARY KEY, query TEXT);`);
        }
        
        const cabysCatalogTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='cabys_catalog'`).get();
        if (!cabysCatalogTable) {
            console.log("MIGRATION: Creating cabys_catalog table.");
            db.exec(`
                CREATE TABLE cabys_catalog (
                    code TEXT PRIMARY KEY,
                    description TEXT NOT NULL,
                    taxRate REAL
                );
            `);
        }

        const exchangeRatesTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='exchange_rates'`).get();
        if (!exchangeRatesTable) {
            console.log("MIGRATION: Creating exchange_rates table.");
            db.exec(`CREATE TABLE exchange_rates (date TEXT PRIMARY KEY, rate REAL NOT NULL);`);
        }

        const suggestionsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='suggestions'`).get();
        if (!suggestionsTable) {
            console.log("MIGRATION: Creating suggestions table.");
            db.exec(`
                CREATE TABLE suggestions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    userId INTEGER,
                    userName TEXT,
                    isRead INTEGER DEFAULT 0,
                    timestamp TEXT NOT NULL
                );
            `);
        }

    } catch (error) {
        console.error("Failed to apply migrations:", error);
    }
}
async function initializeMainDatabase(db: import('better-sqlite3').Database) {
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

        CREATE TABLE company_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            name TEXT, taxId TEXT, address TEXT, phone TEXT, email TEXT,
            logoUrl TEXT, systemName TEXT,
            quotePrefix TEXT, nextQuoteNumber INTEGER, decimalPlaces INTEGER, quoterShowTaxId BOOLEAN,
            searchDebounceTime INTEGER, syncWarningHours INTEGER, importMode TEXT, lastSyncTimestamp TEXT,
            customerFilePath TEXT, productFilePath TEXT, exemptionFilePath TEXT,
            stockFilePath TEXT, locationFilePath TEXT, cabysFilePath TEXT,
            supportPackages TEXT,
            servicesCatalog TEXT
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

    db.prepare(`INSERT OR IGNORE INTO company_settings (id, name, taxId, address, phone, email, systemName, quotePrefix, nextQuoteNumber, decimalPlaces, quoterShowTaxId, searchDebounceTime, syncWarningHours, importMode, supportPackages, servicesCatalog) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        initialCompany.name, initialCompany.taxId, initialCompany.address, initialCompany.phone, initialCompany.email, initialCompany.systemName,
        initialCompany.quotePrefix, initialCompany.nextQuoteNumber, initialCompany.decimalPlaces, true, initialCompany.searchDebounceTime, initialCompany.syncWarningHours, initialCompany.importMode, 
        JSON.stringify(initialCompany.supportPackages), JSON.stringify(initialCompany.servicesCatalog)
    );
    
    db.prepare(`INSERT OR IGNORE INTO api_settings (id, exchangeRateApi, haciendaExemptionApi, haciendaTributariaApi) VALUES (1, ?, ?, ?)`).run(
        'https://api.hacienda.go.cr/indicadores/tc/dolar', 
        'https://api.hacienda.go.cr/fe/ex?autorizacion=',
        'https://api.hacienda.go.cr/fe/ae?identificacion='
    );

    db.prepare('INSERT OR IGNORE INTO exemption_laws (docType, institutionName, authNumber) VALUES (?, ?, ?)')
        .run('99', 'Régimen de Zona Franca', '9635');
    db.prepare('INSERT OR IGNORE INTO exemption_laws (docType, institutionName) VALUES (?, ?), (?, ?), (?, ?), (?, ?), (?, ?)')
        .run('02', 'Exento para Compras Autorizadas', '03', 'Ventas a Diplomáticos', '04', 'Ventas a la CCSS', '05', 'Ventas a Instituciones Públicas', '06', 'Otros');

    const roleInsert = db.prepare('INSERT INTO roles (id, name, permissions) VALUES (@id, @name, @permissions)');
    initialRoles.forEach(role => roleInsert.run({ ...role, permissions: JSON.stringify(role.permissions) }));
    
    const initialQueries: ImportQuery[] = [
        { type: 'customers', query: "SELECT CLIENTE, NOMBRE, DIRECCION, TELEFONO1, CONTRIBUYENTE, MONEDA, LIMITE_CREDITO, CONDICION_PAGO, VENDEDOR, ACTIVO, E_MAIL, EMAIL_DOC_ELECTRONICO FROM SOFTLAND.GAREND.CLIENTE WHERE ACTIVO = 'S'" },
        { type: 'products', query: "SELECT ARTICULO, DESCRIPCION, CLASIFICACION_2, ULTIMO_INGRESO, ACTIVO, NOTAS, UNIDAD_VENTA, CANASTA_BASICA, CODIGO_HACIENDA FROM SOFTLAND.GAREND.ARTICULO WHERE ACTIVO = 'S'" },
        { type: 'exemptions', query: "SELECT CODIGO, DESCRIPCION, CLIENTE, NUM_AUTOR, FECHA_RIGE, FECHA_VENCE, PORCENTAJE, TIPO_DOC, NOMBRE_INSTITUCION, CODIGO_INSTITUCION FROM SOFTLAND.GAREND.EXO_CLIENTE" },
        { type: 'stock', query: "SELECT ARTICULO, BODEGA, CANT_DISPONIBLE FROM SOFTLAND.GAREND.EXISTENCIA_BODEGA WHERE CANT_DISPONIBLE > 0" },
        { type: 'locations', query: "" },
        { type: 'cabys', query: "SELECT [CODIGO], [DESCRIPCION], [IMPUESTO] FROM [SOFTLAND].[GAREND].[CODIGO_HACIENDA]" },
    ];
    const queryInsert = db.prepare('INSERT OR IGNORE INTO import_queries (type, query) VALUES (@type, @query)');
    initialQueries.forEach(q => queryInsert.run(q));

    console.log(`Database ${DB_FILE} initialized with default users, company settings, and roles.`);
    await checkAndApplyMigrations(db);
}
// The rest of db.ts remains the same...
// ... (omitting the rest of the file for brevity as it's unchanged) ...

    

// Re-exporting functions that were causing import errors
export { getUnreadSuggestionsCount, getSuggestions, markSuggestionAsRead, deleteSuggestion } from './suggestions-actions';
export { getAllRoles, saveAllRoles, resetDefaultRoles } from './roles-db';
export { getAllCustomers, getAllProducts, getAllStock, getAllExemptions, getCabysCatalog } from './data-access-db';
export { getCompanySettings, saveCompanySettings, getApiSettings, saveApiSettings, getExemptionLaws, saveExemptionLaws, getAndCacheExchangeRate } from './settings-db';
export { importData, importAllDataFromFiles } from './import-service';
export { getLogs, clearLogs } from './logger';
export { getSqlConfig, saveSqlConfig, saveImportQueries, getImportQueries, testSqlConnection } from './config-db-client';
export { backupAllForUpdate, restoreAllFromUpdateBackup, listAllUpdateBackups, deleteOldUpdateBackups, uploadBackupFile, factoryReset, getDbModules } from './maintenance-db';
export { getStockSettings, saveStockSettings } from './stock-db';
