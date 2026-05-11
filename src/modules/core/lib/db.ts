/**
 * @fileoverview Main database initialization and shared utility functions.
 * Unified into a single source of truth: intratool.db
 * Refactorizado para blindaje de producción: Normalización estricta e idempotencia.
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

/**
 * Runs ONLY if the database file is newly created.
 */
export async function initializeMainDatabase(db: Database) {
    // Initial data seeding - only if users table is empty
    const userCount = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!userCount) {
        // Table doesn't even exist yet, we'll let migrations create it and then seed
        return;
    }
}

function seedGeographicData(db: Database) {
    const insertProv = db.prepare('INSERT OR REPLACE INTO provinces (id, name) VALUES (?, ?)');
    const insertCant = db.prepare('INSERT OR REPLACE INTO cantons (id, provinceId, name) VALUES (?, ?, ?)');
    const insertDist = db.prepare('INSERT OR REPLACE INTO districts (id, cantonId, name) VALUES (?, ?, ?)');

    db.transaction(() => {
        for (const [pId, pData] of Object.entries(COSTA_RICA_GEO_DATA.provincias)) {
            const provinceId = parseInt(pId, 10);
            insertProv.run(provinceId, pData.nombre);

            for (const [cId, cData] of Object.entries(pData.cantones)) {
                const cantonId = provinceId * 100 + parseInt(cId, 10);
                insertCant.run(cantonId, provinceId, cData.nombre);

                for (const [dId, dName] of Object.entries(cData.distritos)) {
                    const districtId = cantonId * 100 + parseInt(dId, 10);
                    insertDist.run(districtId, cantonId, dName);
                }
            }
        }
    })();
}

function seedNotificationTemplates(db: Database) {
    const templates = [
        {
            eventId: 'onTicketCreated',
            subject: '[NUEVO TICKET] {{consecutive}} - {{subject}}',
            body: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2563eb; margin-top: 0;">Nuevo Ticket Registrado</h2>
                    <p>Hola <b>{{customerName}}</b>, hemos recibido tu solicitud de soporte para la empresa <b>{{companyName}}</b>.</p>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><b>ID del Caso:</b> {{consecutive}}</p>
                        <p style="margin: 5px 0;"><b>Servicio:</b> {{serviceName}}</p>
                        <p style="margin: 5px 0;"><b>Asunto:</b> {{subject}}</p>
                        <p style="margin: 5px 0;"><b>Técnico:</b> {{assigneeName}}</p>
                        {{#if isBillable}}
                        <p style="margin: 15px 0 5px 0; color: #dc2626; font-weight: bold;">⚠️ NOTA DE FACTURACIÓN:</p>
                        <p style="margin: 0; font-size: 13px;">Este servicio se encuentra fuera de su cobertura actual y genera un cargo adicional.</p>
                        <p style="margin: 5px 0; font-size: 14px; font-weight: bold;">Precio Sugerido: {{formattedPrice}}</p>
                        {{/if}}
                    </div>
                    <p style="font-size: 13px; color: #666;">Un técnico revisará tu caso a la brevedad. Gracias por confiar en nosotros.</p>
                </div>`,
            telegram: '🆕 <b>NUEVO TICKET</b>\n\n<b>ID:</b> {{consecutive}}\n<b>Cliente:</b> {{companyName}}\n<b>Contacto:</b> {{customerName}}\n<b>Servicio:</b> {{serviceName}}\n<b>Asunto:</b> {{subject}}\n<b>Técnico:</b> {{assigneeName}}\n<b>Fecha:</b> {{formattedDateTime}}\n\n{{#if isBillable}}⚠️ <b>FACTURABLE:</b> {{formattedPrice}}{{/if}}',
            internal: 'Nuevo ticket {{consecutive}} de {{companyName}} ({{customerName}})'
        },
        {
            eventId: 'onTicketStatusChanged',
            subject: '[ACTUALIZACIÓN] Ticket {{consecutive}} - Cambio de Estado',
            body: '<div style="font-family: sans-serif; color: #333;"><h2>Actualización de Ticket</h2><p>El ticket <b>{{consecutive}}</b> ha cambiado su estado a: <b style="color: #2563eb;">{{status}}</b></p></div>',
            telegram: '🔄 <b>CAMBIO DE ESTADO</b>\n\n<b>ID:</b> {{consecutive}}\n<b>Cliente:</b> {{companyName}}\n<b>Contacto:</b> {{customerName}}\n<b>Nuevo Estado:</b> <b>{{status}}</b>\n<b>Técnico:</b> {{assigneeName}}',
            internal: 'Ticket {{consecutive}} cambió estado a {{status}}'
        },
        {
            eventId: 'onTicketCompleted',
            subject: '[CASO RESUELTO] Ticket {{consecutive}}',
            body: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #16a34a; margin-top: 0;">Caso de Soporte Finalizado</h2>
                    <p>Estimado(a) <b>{{customerName}}</b>, su solicitud <b>{{consecutive}}</b> ha sido resuelta satisfactoriamente.</p>
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h4 style="margin: 0 0 10px 0;">Detalle de Resolución:</h4>
                        <p style="margin: 0; font-size: 14px; line-height: 1.5;">{{content}}</p>
                    </div>
                    <p style="font-size: 12px; color: #999;">Cerrado por: {{userName}}</p>
                </div>`,
            telegram: '✅ <b>TICKET COMPLETADO</b>\n\n<b>ID:</b> {{consecutive}}\n<b>Cliente:</b> {{companyName}}\n<b>Contacto:</b> {{customerName}}\n<b>Resuelto por:</b> {{userName}}\n\n<b>Resolución:</b>\n<i>{{content}}</i>',
            internal: 'Ticket {{consecutive}} completado con éxito.'
        },
        {
            eventId: 'onTicketCanceled',
            subject: '[ANULADO] Ticket {{consecutive}}',
            body: '<div style="font-family: sans-serif;"><h2>Ticket Anulado</h2><p>El caso <b>{{consecutive}}</b> ha sido cancelado.</p><p><b>Motivo:</b> {{content}}</p></div>',
            telegram: '❌ <b>TICKET ANULADO</b>\n\n<b>ID:</b> {{consecutive}}\n<b>Cliente:</b> {{companyName}}\n<b>Contacto:</b> {{customerName}}\n\n<b>Motivo:</b>\n<i>{{content}}</i>',
            internal: 'Ticket {{consecutive}} fue cancelado.'
        },
        {
            eventId: 'onTicketReplyAdded',
            subject: '[NUEVA RESPUESTA] Ticket {{consecutive}}',
            body: '<div style="font-family: sans-serif; color: #333;"><h2>Nueva Respuesta en su Ticket</h2><p>El técnico <b>{{userName}}</b> ha respondido a su solicitud <b>{{consecutive}}</b>:</p><div style="background: #f9fafb; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">{{content}}</div><p style="font-size: 12px; color: #666;">Ingrese al portal para más detalles.</p></div>',
            telegram: '💬 <b>NUEVA RESPUESTA</b>\n\n<b>Ticket:</b> {{consecutive}}\n<b>De:</b> {{userName}}\n\n<b>Mensaje:</b>\n<i>{{content}}</i>',
            internal: 'Nueva respuesta en ticket {{consecutive}} de {{userName}}'
        },
        {
            eventId: 'onTicketPriorityUrgent',
            subject: '[URGENTE] Atención requerida en Ticket {{consecutive}}',
            body: '<div style="font-family: sans-serif; border: 2px solid red; padding: 20px;"><h2>PRIORIDAD URGENTE</h2><p>El ticket <b>{{consecutive}}</b> ha sido marcado como URGENTE.</p><p><b>Asunto:</b> {{subject}}</p></div>',
            telegram: '🚨 <b>¡URGENCIA DETECTADA!</b>\n\n<b>Ticket:</b> {{consecutive}}\n<b>Cliente:</b> {{companyName}}\n<b>Asunto:</b> {{subject}}',
            internal: '¡Ticket {{consecutive}} marcado como URGENTE!'
        },
        {
            eventId: 'onTicketVisitScheduled',
            subject: '[{{serviceName}}] Programada para {{consecutive}}',
            body: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2563eb; margin-top: 0;">{{serviceName}} Programada</h2>
                    <p>Hola <b>{{customerName}}</b>, le informamos que se ha programado el servicio de <b>{{serviceName}}</b> para atender su caso.</p>
                    <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><b>Técnico encargado:</b> {{technicianName}}</p>
                        <p style="margin: 5px 0;"><b>Día:</b> {{visitDate}}</p>
                        <p style="margin: 5px 0;"><b>Hora aprox:</b> {{visitTime}}</p>
                    </div>
                    <p style="font-size: 13px; color: #666;">Por favor, asegúrese de estar disponible para la ejecución del servicio.</p>
                </div>`,
            telegram: '🗓️ <b>{{serviceName}} PROGRAMADA</b>\n\n<b>Ticket:</b> {{consecutive}}\n<b>Cliente:</b> {{companyName}}\n<b>Técnico:</b> {{technicianName}}\n<b>Fecha:</b> {{visitDate}}\n<b>Hora aprox:</b> {{visitTime}}',
            internal: '{{serviceName}} programada para {{consecutive}} ({{technicianName}})'
        },
        {
            eventId: 'onContractExpiring',
            subject: '[ALERTA] Contrato por vencer: {{name}}',
            body: '<div style="font-family: sans-serif;"><h2 style="color: #ea580c;">Vencimiento de Contrato Próximo</h2><p>El contrato <b>{{name}}</b> del cliente <b>{{customerName}}</b> vencerá en <b>{{daysLeft}} días</b>.</p><p>Fecha de vencimiento: {{endDate}}</p></div>',
            telegram: '⚠️ <b>CONTRATO POR VENCER</b>\n\n<b>Cliente:</b> {{customerName}}\n<b>Contrato:</b> {{name}}\n<b>Días restantes:</b> {{daysLeft}}\n<b>Vence:</b> {{endDate}}',
            internal: 'El contrato {{name}} de {{customerName}} vence en {{daysLeft}} días.'
        },
        {
            eventId: 'onLicenseExpiring',
            subject: '[RENOVACIÓN] Tu licencia de {{softwareName}} vence pronto',
            body: '<div style="font-family: sans-serif; color: #333;"><h2 style="color: #2563eb;">Aviso de Renovación de Software</h2><p>Estimado(a) <b>{{customerName}}</b>,</p><p>Le informamos que su licencia de <b>{{softwareName}}</b> está próxima a vencer.</p><div style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;"><p><b>Software:</b> {{softwareName}}</p><p><b>Vencimiento:</b> {{expirationDate}}</p><p><b>Días restantes:</b> {{daysLeft}}</p></div><p>Por favor, póngase en contacto con nosotros para gestionar su renovación y evitar interrupciones en el servicio.</p></div>',
            telegram: '🔑 <b>LICENCIA POR VENCER</b>\n\n<b>Cliente:</b> {{customerName}}\n<b>Software:</b> {{softwareName}}\n<b>Vence:</b> {{expirationDate}}\n<b>Restan:</b> {{daysLeft}} días',
            internal: 'Licencia {{softwareName}} de {{customerName}} vence en {{daysLeft}} días.'
        },
        {
            eventId: 'onLicenseAssigned',
            subject: '[ASIGNACIÓN] {{licenseStatus}}: {{softwareName}}',
            body: '<div style="font-family: sans-serif; color: #333;"><h2 style="color: #2563eb;">{{licenseStatus}}</h2><p>Hola <b>{{customerName}}</b>, se ha registrado una nueva licencia de software en su perfil.</p><div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;"><p><b>Software:</b> {{softwareName}}</p><p><b>Tipo:</b> {{type}}</p><p><b>Estado:</b> {{licenseStatus}}</p><p><b>Vencimiento:</b> {{expirationDate}}</p>{{#if hardwareId}}<p><b>Hardware ID:</b> {{hardwareId}}</p>{{/if}}</div><p style="font-size: 12px; color: #666;">Gracias por su preferencia.</p></div>',
            telegram: '🔑 <b>{{licenseStatus}}</b>\n\n<b>Software:</b> {{softwareName}}\n<b>Cliente:</b> {{customerName}}\n<b>Vence:</b> {{expirationDate}}',
            internal: '{{licenseStatus}}: {{softwareName}} para {{customerName}}'
        },
        {
            eventId: 'onContractAutoRenewed',
            subject: '[INFO] Renovación Automática: {{consecutive}}',
            body: '<div style="font-family: sans-serif;"><h2>Contrato Renovado Automáticamente</h2><p>El contrato de <b>{{customerName}}</b> ha sido renovado bajo la cláusula de prórroga automática.</p><p>Nueva vigencia hasta: <b>{{endDate}}</b></p></div>',
            telegram: '🔄 <b>CONTRATO RENOVADO</b>\n\n<b>ID:</b> {{consecutive}}\n<b>Cliente:</b> {{customerName}}\n<b>Nueva fecha fin:</b> {{endDate}}',
            internal: 'Contrato {{consecutive}} renovado automáticamente.'
        }
    ];

    const insert = db.prepare('INSERT OR REPLACE INTO notification_templates (eventId, subject, body, telegram, internal) VALUES (@eventId, @subject, @body, @telegram, @internal)');
    templates.forEach(t => insert.run(t));
}

/**
 * Primary place for structural health.
 * Runs in EVERY start to ensure all tables exist.
 */
export async function runMainMigrations(db: Database) {
    // 1. ENSURE ALL TABLES EXIST (Idempotent Creation)
    const schema = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
            phone TEXT, whatsapp TEXT, avatar TEXT, role TEXT NOT NULL,
            recentActivity TEXT, securityQuestion TEXT, securityAnswer TEXT,
            forcePasswordChange INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS roles (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS company_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            name TEXT, taxId TEXT, address TEXT, phone TEXT, email TEXT,
            logoUrl TEXT, systemName TEXT, systemVersion TEXT, publicUrl TEXT,
            quotePrefix TEXT, nextQuoteNumber INTEGER, decimalPlaces INTEGER, quoterShowTaxId BOOLEAN,
            searchDebounceTime INTEGER, syncWarningHours INTEGER, importMode TEXT, lastSyncTimestamp TEXT,
            customerFilePath TEXT, productFilePath TEXT, exemptionFilePath TEXT,
            stockFilePath TEXT, cabysFilePath TEXT,
            supportPackages TEXT, servicesCatalog TEXT, internalHourCost REAL DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS api_settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            exchangeRateApi TEXT, haciendaExemptionApi TEXT, haciendaTributariaApi TEXT
        );

        CREATE TABLE IF NOT EXISTS email_settings (
            key TEXT PRIMARY KEY, value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
            type TEXT NOT NULL, message TEXT NOT NULL, details TEXT
        );

        CREATE TABLE IF NOT EXISTS suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL,
            userId INTEGER, userName TEXT, isRead INTEGER DEFAULT 0, timestamp TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, commercialName TEXT,
            address TEXT, phone TEXT, taxId TEXT NOT NULL, currency TEXT DEFAULT 'CRC',
            creditLimit REAL DEFAULT 0, paymentCondition TEXT DEFAULT '0',
            salesperson TEXT, active TEXT DEFAULT 'S', email TEXT,
            electronicDocEmail TEXT, isManual INTEGER DEFAULT 0, contacts TEXT,
            supportPackageId TEXT, parentCustomerId TEXT, taxRegime TEXT,
            taxStatus TEXT, isTaxMoroso INTEGER DEFAULT 0, isTaxOmiso INTEGER DEFAULT 0,
            taxAdministration TEXT, taxActivities TEXT, provinceId INTEGER,
            cantonId INTEGER, districtId INTEGER, telegramChatId TEXT,
            isBlocked INTEGER DEFAULT 0, blockedReason TEXT,
            notifyTickets INTEGER DEFAULT 1, notifyLicenses INTEGER DEFAULT 1,
            isLead INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY, description TEXT NOT NULL, classification TEXT,
            lastEntry TEXT, active TEXT DEFAULT 'S', notes TEXT, unit TEXT,
            isBasicGood TEXT DEFAULT 'N', cabys TEXT
        );

        CREATE TABLE IF NOT EXISTS stock (
            itemId TEXT PRIMARY KEY, stockByWarehouse TEXT NOT NULL, totalStock REAL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS exemptions (
            code TEXT PRIMARY KEY, description TEXT, customer TEXT,
            authNumber TEXT, startDate TEXT, endDate TEXT,
            percentage REAL, docType TEXT, institutionName TEXT, institutionCode TEXT
        );

        CREATE TABLE IF NOT EXISTS cabys_catalog (
            code TEXT PRIMARY KEY, description TEXT NOT NULL, taxRate REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT, consecutive TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL, customerId TEXT NOT NULL, startDate TEXT NOT NULL,
            endDate TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
            includedServices TEXT NOT NULL, excludedServices TEXT NOT NULL,
            monthlyHours REAL DEFAULT 0, price REAL DEFAULT 0,
            currency TEXT DEFAULT 'CRC', notes TEXT, autoRenew INTEGER DEFAULT 0, createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS help_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
            defaultPriority TEXT, defaultAssigneeId INTEGER, defaultServiceId TEXT
        );

        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT, consecutive TEXT UNIQUE NOT NULL,
            subject TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL,
            createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, dueDate TEXT,
            companyId INTEGER, customerName TEXT, customerEmail TEXT,
            customerPhone TEXT, companyName TEXT, assigneeId INTEGER,
            helpTopicId INTEGER, serviceId TEXT, contractId INTEGER,
            licenseId INTEGER, equipmentId TEXT, isBillable INTEGER DEFAULT 0,
            providerId INTEGER, providerContactId TEXT, scheduledVisit TEXT
        );

        CREATE TABLE IF NOT EXISTS ticket_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ticketId INTEGER NOT NULL,
            userId INTEGER, userName TEXT, type TEXT NOT NULL,
            content TEXT, createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS third_party_providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            email TEXT, phone TEXT, specialty TEXT, notes TEXT,
            contacts TEXT, createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS software_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            isInternal BOOLEAN NOT NULL DEFAULT FALSE, currentVersion TEXT,
            m01_name TEXT, m02_name TEXT, m03_name TEXT, m04_name TEXT, m05_name TEXT,
            m06_name TEXT, m07_name TEXT, m08_name TEXT, m09_name TEXT, m10_name TEXT
        );

        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT, licenseKey TEXT NOT NULL,
            activationToken TEXT, softwareId INTEGER NOT NULL, customerId TEXT,
            hardwareId TEXT, isPerpetual BOOLEAN NOT NULL DEFAULT FALSE,
            expirationDate TEXT, status TEXT NOT NULL DEFAULT 'active', createdAt TEXT NOT NULL,
            m01_val INTEGER DEFAULT 0, m02_val INTEGER DEFAULT 0, m03_val INTEGER DEFAULT 0,
            m04_val INTEGER DEFAULT 0, m05_val INTEGER DEFAULT 0, m06_val INTEGER DEFAULT 0,
            m07_val INTEGER DEFAULT 0, m08_val INTEGER DEFAULT 0, m09_val INTEGER DEFAULT 0,
            m10_val INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ticketId INTEGER NOT NULL,
            userId INTEGER NOT NULL, startTime TEXT NOT NULL, endTime TEXT,
            duration INTEGER, billableDuration INTEGER, billingStatus TEXT DEFAULT 'pending',
            externalInvoiceNumber TEXT, notes TEXT, isBillable BOOLEAN NOT NULL DEFAULT TRUE,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS marketing_ads (
            id INTEGER PRIMARY KEY AUTOINCREMENT, softwareId INTEGER NOT NULL,
            imageUrl TEXT NOT NULL, description TEXT NOT NULL, price TEXT,
            targetUrl TEXT, isEnabled INTEGER DEFAULT 1, targetType TEXT DEFAULT 'all',
            expiresAt TEXT, createdAt TEXT NOT NULL,
            FOREIGN KEY (softwareId) REFERENCES software_products(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notification_templates (
            eventId TEXT PRIMARY KEY, subject TEXT NOT NULL,
            body TEXT NOT NULL, telegram TEXT NOT NULL, internal TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notification_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            event TEXT NOT NULL, action TEXT NOT NULL, recipients TEXT NOT NULL,
            subject TEXT, enabled INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            schedule TEXT NOT NULL, taskId TEXT NOT NULL, enabled INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL,
            message TEXT NOT NULL, href TEXT, isRead INTEGER DEFAULT 0,
            timestamp TEXT NOT NULL, entityId INTEGER, entityType TEXT
        );

        CREATE TABLE IF NOT EXISTS otp_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            isUsed INTEGER DEFAULT 0
        );

        -- SHARED TABLES
        CREATE TABLE IF NOT EXISTS exchange_rates (date TEXT PRIMARY KEY, rate REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS provinces (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS cantons (id INTEGER PRIMARY KEY, provinceId INTEGER NOT NULL, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS districts (id INTEGER PRIMARY KEY, cantonId INTEGER NOT NULL, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS contract_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ticket_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS planner_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS notification_settings (service TEXT PRIMARY KEY, config TEXT NOT NULL);
    `;

    db.exec(schema);

    // 2. COLUMN MIGRATIONS (Safe Checks)
    const tableInfo = (table: string) => {
        try { return db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]; } 
        catch { return []; }
    };
    const hasColumn = (table: string, col: string) => new Set(tableInfo(table).map(c => c.name)).has(col);

    // Incremental Schema Updates
    if (!hasColumn('users', 'forcePasswordChange')) db.exec(`ALTER TABLE users ADD COLUMN forcePasswordChange INTEGER DEFAULT 0;`);
    if (!hasColumn('company_settings', 'systemVersion')) db.exec(`ALTER TABLE company_settings ADD COLUMN systemVersion TEXT;`);
    if (!hasColumn('company_settings', 'publicUrl')) db.exec(`ALTER TABLE company_settings ADD COLUMN publicUrl TEXT;`);
    if (!hasColumn('company_settings', 'internalHourCost')) db.exec(`ALTER TABLE company_settings ADD COLUMN internalHourCost REAL DEFAULT 0;`);
    if (!hasColumn('customers', 'isLead')) db.exec(`ALTER TABLE customers ADD COLUMN isLead INTEGER DEFAULT 0;`);

    // 3. SEEDING & DATA UPDATES
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count === 0) {
        const userInsert = db.prepare('INSERT OR IGNORE INTO users (id, name, email, password, phone, whatsapp, role, forcePasswordChange) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        initialUsers.forEach(user => {
            const hashedPassword = bcrypt.hashSync(user.password!, SALT_ROUNDS);
            userInsert.run(user.id, user.name, user.email, hashedPassword, user.phone, user.whatsapp, user.role, 0);
        });
    }

    const roleInsert = db.prepare('INSERT OR IGNORE INTO roles (id, name, permissions) VALUES (?, ?, ?)');
    initialRoles.forEach(role => roleInsert.run(role.id, role.name, JSON.stringify(role.permissions)));

    db.prepare(`INSERT OR IGNORE INTO contract_settings (key, value) VALUES ('contractPrefix', 'CON-'), ('nextContractNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO ticket_settings (key, value) VALUES ('ticketPrefix', 'CAS-'), ('nextTicketNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('projectPrefix', 'PROJ-'), ('nextProjectNumber', '1'), ('pdfTopLegend', 'ACTA DE ENTREGA DE PROYECTO TI')`).run();
    db.prepare(`INSERT OR IGNORE INTO notification_settings (service, config) VALUES ('telegram', ?)`).run(JSON.stringify({ botToken: '', chatId: '' }));

    seedGeographicData(db);
    seedNotificationTemplates(db);
}

export async function getUserCount(): Promise<number> {
    const db = await connectDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return result.count;
}

export async function getUnreadSuggestionsCount(): Promise<number> {
    const db = await connectDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM suggestions WHERE isRead = 0').get() as { count: number };
    return result.count;
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

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ' WHERE 1=1';
    query += whereClause + ' ORDER BY timestamp DESC LIMIT 500';

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
    db.prepare('INSERT OR REPLACE INTO user_preferences (userId, key, value) VALUES (?, ?)').run(userId, key, JSON.stringify(value));
}
