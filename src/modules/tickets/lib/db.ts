/**
 * @fileoverview Server-side functions for the support tickets database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import { getCompanySettings } from '../../core/lib/settings-db';
import type { Ticket, NewTicketPayload, User, TicketThread, HelpTopic, ClientCompany, SupportPackage, Service, Customer } from '@/modules/core/types';

const TICKETS_DB_FILE = 'tickets.db';

// Ensure you have a secret key in your environment variables
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-key-for-licenses');

export async function initializeTicketsDb(db: import('better-sqlite3').Database): Promise<void> {
    const schema = `
        CREATE TABLE IF NOT EXISTS client_companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            taxId TEXT UNIQUE NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS company_branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            companyId INTEGER NOT NULL,
            name TEXT NOT NULL,
            address TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (companyId) REFERENCES client_companies(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS company_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            companyId INTEGER NOT NULL,
            branchId INTEGER,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            isPrimary BOOLEAN DEFAULT FALSE,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (companyId) REFERENCES client_companies(id) ON DELETE CASCADE,
            FOREIGN KEY (branchId) REFERENCES company_branches(id) ON DELETE SET NULL
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
            status TEXT NOT NULL, -- open, in_progress, on_hold, closed
            priority TEXT NOT NULL, -- low, medium, high, urgent
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            dueDate TEXT,
            
            companyId INTEGER,
            
            -- Denormalized for quick display & for customers not in the company structure
            customerName TEXT, 
            companyName TEXT, -- Denormalized company name

            assigneeId INTEGER, -- User ID from intratool.db
            helpTopicId INTEGER,
            serviceId TEXT, -- From main DB services catalog

            FOREIGN KEY (companyId) REFERENCES client_companies(id) ON DELETE SET NULL,
            FOREIGN KEY (helpTopicId) REFERENCES help_topics(id)
        );

        CREATE TABLE IF NOT EXISTS ticket_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketId INTEGER NOT NULL,
            userId INTEGER, -- Who performed the action
            userName TEXT,
            type TEXT NOT NULL, -- message, note, status_change
            content TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ticket_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            threadId INTEGER NOT NULL,
            fileName TEXT NOT NULL,
            fileData BLOB NOT NULL,
            mimeType TEXT,
            FOREIGN KEY (threadId) REFERENCES ticket_threads(id) ON DELETE CASCADE
        );
        
        CREATE TABLE IF NOT EXISTS ticket_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `;
    db.exec(schema);

    db.prepare(`INSERT OR IGNORE INTO ticket_settings (key, value) VALUES ('ticketPrefix', 'CAS-')`).run();
    db.prepare(`INSERT OR IGNORE INTO ticket_settings (key, value) VALUES ('nextTicketNumber', '1')`).run();

    // Insert default help topics
    const topics = [
        { id: 1, name: 'Soporte General', defaultPriority: 'medium', defaultAssigneeId: null, defaultServiceId: null },
        { id: 2, name: 'Consulta de Facturación', defaultPriority: 'medium', defaultAssigneeId: null, defaultServiceId: null },
        { id: 3, name: 'Problema con Impresora', defaultPriority: 'high', defaultAssigneeId: null, defaultServiceId: null }
    ];
    const insertTopic = db.prepare('INSERT OR IGNORE INTO help_topics (id, name, defaultPriority, defaultAssigneeId, defaultServiceId) VALUES (@id, @name, @defaultPriority, @defaultAssigneeId, @defaultServiceId)');
    topics.forEach(topic => insertTopic.run(topic));
    
    console.log(`Database ${TICKETS_DB_FILE} initialized for Support Tickets.`);
    await runTicketMigrations(db);
}

export async function runTicketMigrations(db: import('better-sqlite3').Database) {
    const ticketsTableInfo = db.prepare(`PRAGMA table_info(tickets)`).all() as { name: string }[];
    const ticketsColumns = new Set(ticketsTableInfo.map(c => c.name));

    if (!ticketsColumns.has('companyName')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN companyName TEXT;`);
    }
     if (!ticketsColumns.has('helpTopicId')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN helpTopicId INTEGER;`);
    }
     if (!ticketsColumns.has('serviceId')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN serviceId TEXT;`);
    }
    if (!ticketsColumns.has('dueDate')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN dueDate TEXT;`);
    }
    if (ticketsColumns.has('erpCustomerId')) {
        // This is a more complex migration to move from the old customer system.
        // It's safer to check for the old columns and rename the table if needed.
        // For simplicity here, we assume a fresh start or manual migration if this fails.
        console.log("Migration: Re-structuring tickets table for new customer model.");
        try {
            db.exec(`
                CREATE TABLE tickets_new (
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
                    companyName TEXT,
                    assigneeId INTEGER,
                    helpTopicId INTEGER,
                    serviceId TEXT,
                    FOREIGN KEY (companyId) REFERENCES client_companies(id) ON DELETE SET NULL,
                    FOREIGN KEY (helpTopicId) REFERENCES help_topics(id)
                );
            `);
             db.exec(`
                INSERT INTO tickets_new (id, consecutive, subject, status, priority, createdAt, updatedAt, customerName, assigneeId)
                SELECT id, consecutive, subject, status, priority, createdAt, updatedAt, customerName, assigneeId FROM tickets;
            `);
            db.exec(`DROP TABLE tickets;`);
            db.exec(`ALTER TABLE tickets_new RENAME TO tickets;`);
        } catch (e) {
            console.error("Failed to migrate tickets table. A manual migration might be needed.", e);
        }
    }


    const helpTopicsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='help_topics'`).get();
    if (helpTopicsTable) {
        const topicsTableInfo = db.prepare(`PRAGMA table_info(help_topics)`).all() as { name: string }[];
        const topicsColumns = new Set(topicsTableInfo.map(c => c.name));
        if (!topicsColumns.has('defaultServiceId')) {
            db.exec(`ALTER TABLE help_topics ADD COLUMN defaultServiceId TEXT;`);
        }
    } else {
         db.exec(`
            CREATE TABLE IF NOT EXISTS help_topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                defaultPriority TEXT,
                defaultAssigneeId INTEGER,
                defaultServiceId TEXT
            );
        `);
        // Populate with some defaults if it didn't exist
        const topics = [
            { id: 1, name: 'Soporte General', defaultPriority: 'medium', defaultAssigneeId: null, defaultServiceId: null },
            { id: 2, name: 'Consulta de Facturación', defaultPriority: 'medium', defaultAssigneeId: null, defaultServiceId: null },
            { id: 3, name: 'Problema con Impresora', defaultPriority: 'high', defaultAssigneeId: null, defaultServiceId: null }
        ];
        const insertTopic = db.prepare('INSERT OR IGNORE INTO help_topics (id, name, defaultPriority, defaultAssigneeId, defaultServiceId) VALUES (@id, @name, @defaultPriority, @defaultAssigneeId, @defaultServiceId)');
        topics.forEach(topic => insertTopic.run(topic));
    }
}

async function getNextTicketNumber(db: import('better-sqlite3').Database): Promise<{ prefix: string; number: number }> {
    const prefixRow = db.prepare("SELECT value FROM ticket_settings WHERE key = 'ticketPrefix'").get() as { value: string } | undefined;
    const numberRow = db.prepare("SELECT value FROM ticket_settings WHERE key = 'nextTicketNumber'").get() as { value: string } | undefined;

    const prefix = prefixRow?.value || 'CAS-';
    const number = numberRow ? parseInt(numberRow.value, 10) : 1;

    return { prefix, number };
}

export async function addTicket(payload: NewTicketPayload, user: User): Promise<Ticket> {
    const db = await connectDb(TICKETS_DB_FILE);
    
    const { prefix, number } = await getNextTicketNumber(db);

    const transaction = db.transaction(() => {
        const consecutive = `${prefix}${number.toString().padStart(6, '0')}`;
        const now = new Date().toISOString();
        
        let priority = payload.priority;
        let assigneeId = payload.assigneeId;

        if (payload.helpTopicId) {
            const topic = db.prepare('SELECT * FROM help_topics WHERE id = ?').get(payload.helpTopicId) as HelpTopic | undefined;
            if (topic) {
                if (topic.defaultPriority && !payload.priority) priority = topic.defaultPriority;
                if (topic.defaultAssigneeId !== undefined && payload.assigneeId === undefined) assigneeId = topic.defaultAssigneeId;
            }
        }
        
        // Find company name if companyId is provided
        let companyName = payload.companyName || '';
        if(payload.companyId) {
            const company = db.prepare('SELECT name FROM client_companies WHERE id = ?').get(payload.companyId) as { name: string } | undefined;
            if(company) companyName = company.name;
        }

        const ticketInsertInfo = db.prepare(`
            INSERT INTO tickets (consecutive, subject, status, priority, createdAt, updatedAt, companyId, customerName, companyName, assigneeId, helpTopicId, serviceId, dueDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(consecutive, payload.subject, 'open', priority, now, now, payload.companyId, payload.customerName, companyName, assigneeId, payload.helpTopicId, payload.serviceId, payload.dueDate || null);
        
        const newTicketId = ticketInsertInfo.lastInsertRowid;

        db.prepare(`
            INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(newTicketId, user.id, user.name, 'message', payload.content, now);

        db.prepare('UPDATE ticket_settings SET value = ? WHERE key = ?').run(String(number + 1), 'nextTicketNumber');

        const newTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(newTicketId) as Ticket;
        return newTicket;
    });

    const result = transaction();
    return JSON.parse(JSON.stringify(result));
}

export async function addClientCompany(payload: Omit<ClientCompany, 'id' | 'createdAt'>): Promise<ClientCompany> {
    const db = await connectDb(TICKETS_DB_FILE);
    const existing = db.prepare('SELECT id FROM client_companies WHERE taxId = ?').get(payload.taxId);
    if(existing) {
        throw new Error('Ya existe una empresa con esa cédula jurídica.');
    }
    const now = new Date().toISOString();
    const info = db.prepare(`
        INSERT INTO client_companies (name, taxId, address, phone, email, createdAt) 
        VALUES (@name, @taxId, @address, @phone, @email, @createdAt)
    `).run({ ...payload, createdAt: now });

    const newId = info.lastInsertRowid as number;
    const result = { ...payload, id: newId, createdAt: now };
    return JSON.parse(JSON.stringify(result));
}

export async function updateClientCompany(payload: ClientCompany): Promise<ClientCompany> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare(`
        UPDATE client_companies 
        SET name = @name, taxId = @taxId, address = @address, phone = @phone, email = @email 
        WHERE id = @id
    `).run(payload);
    return JSON.parse(JSON.stringify(payload));
}

export async function deleteClientCompany(id: number): Promise<void> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('DELETE FROM client_companies WHERE id = ?').run(id);
}


export async function getClientCompanies(): Promise<ClientCompany[]> {
    const db = await connectDb(TICKETS_DB_FILE);
    const results = db.prepare('SELECT * FROM client_companies ORDER BY name ASC').all() as ClientCompany[];
    return JSON.parse(JSON.stringify(results));
}

export async function getTickets(): Promise<Ticket[]> {
    const db = await connectDb(TICKETS_DB_FILE);
    try {
        const stmt = db.prepare('SELECT * FROM tickets ORDER BY createdAt DESC');
        const results = stmt.all() as Ticket[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Failed to get tickets:", error);
        return [];
    }
}

export async function getTicketById(id: number): Promise<Ticket | null> {
    const db = await connectDb(TICKETS_DB_FILE);
    try {
        const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
        const result = stmt.get(id) as Ticket | null;
        return result ? JSON.parse(JSON.stringify(result)) : null;
    } catch (error) {
        console.error(`Failed to get ticket with id ${id}:`, error);
        return null;
    }
}

export async function getTicketThread(ticketId: number): Promise<TicketThread[]> {
    const db = await connectDb(TICKETS_DB_FILE);
    try {
        const stmt = db.prepare('SELECT * FROM ticket_threads WHERE ticketId = ? ORDER BY createdAt ASC');
        const results = stmt.all(ticketId) as TicketThread[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error(`Failed to get thread for ticket id ${ticketId}:`, error);
        return [];
    }
}

export async function addThreadEntry(payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' }): Promise<TicketThread> {
    const db = await connectDb(TICKETS_DB_FILE);
    const { ticketId, userId, userName, content, type } = payload;
    const now = new Date().toISOString();

    const info = db.prepare(`
        INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(ticketId, userId, userName, type, content, now);

    db.prepare('UPDATE tickets SET updatedAt = ? WHERE id = ?').run(now, ticketId);
    
    const result = db.prepare('SELECT * FROM ticket_threads WHERE id = ?').get(info.lastInsertRowid) as TicketThread;
    return JSON.parse(JSON.stringify(result));
}

export async function updateTicketDetails(ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId'>>, user: User): Promise<Ticket> {
    const db = await connectDb(TICKETS_DB_FILE);
    
    const currentTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
    if (!currentTicket) throw new Error("Ticket not found.");
    
    const transaction = db.transaction(() => {
        const now = new Date().toISOString();
        let query = 'UPDATE tickets SET updatedAt = ?';
        const params: (string | number | null)[] = [now];
        const historyNotes: string[] = [];

        if (updates.status && updates.status !== currentTicket.status) {
            query += ', status = ?';
            params.push(updates.status);
            historyNotes.push(`Estado cambiado a: ${updates.status}`);
        }
        if (updates.priority && updates.priority !== currentTicket.priority) {
            query += ', priority = ?';
            params.push(updates.priority);
            historyNotes.push(`Prioridad cambiada a: ${updates.priority}`);
        }
        if (updates.assigneeId !== undefined && updates.assigneeId !== currentTicket.assigneeId) {
            query += ', assigneeId = ?';
            params.push(updates.assigneeId);
            historyNotes.push(`Asignado a nuevo técnico.`);
        }
        
        query += ' WHERE id = ?';
        params.push(ticketId);

        if (params.length > 2) { // more than just updatedAt and id
            db.prepare(query).run(...params);

            if (historyNotes.length > 0) {
                 db.prepare(`
                    INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(ticketId, user.id, user.name, 'status_change', historyNotes.join('. '), now);
            }
        }
    });

    transaction();
    const result = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
    return JSON.parse(JSON.stringify(result));
}

export async function getHelpTopics(): Promise<HelpTopic[]> {
    const db = await connectDb(TICKETS_DB_FILE);
    try {
        const results = db.prepare('SELECT * FROM help_topics ORDER BY name ASC').all() as HelpTopic[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Failed to get help topics:", error);
        return [];
    }
}

export async function addHelpTopic(topic: Omit<HelpTopic, 'id'>): Promise<HelpTopic> {
    const db = await connectDb(TICKETS_DB_FILE);
    const info = db.prepare('INSERT INTO help_topics (name, defaultPriority, defaultAssigneeId, defaultServiceId) VALUES (?, ?, ?, ?)')
        .run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.defaultServiceId);
    const result = db.prepare('SELECT * FROM help_topics WHERE id = ?').get(info.lastInsertRowid) as HelpTopic;
    return JSON.parse(JSON.stringify(result));
}

export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('UPDATE help_topics SET name = ?, defaultPriority = ?, defaultAssigneeId = ?, defaultServiceId = ? WHERE id = ?')
        .run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.defaultServiceId, topic.id);
    const result = db.prepare('SELECT * FROM help_topics WHERE id = ?').get(topic.id) as HelpTopic;
    return JSON.parse(JSON.stringify(result));
}

export async function deleteHelpTopic(id: number): Promise<void> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('DELETE FROM help_topics WHERE id = ?').run(id);
}

export async function deleteTicket(id: number): Promise<void> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
}

export async function getCustomerSupportInfo(companyId: number | string): Promise<{ customer: Customer | ClientCompany | null; supportPackage: SupportPackage | null, services: Service[] }> {
    const mainDb = await connectDb();
    
    // Check if the ID is a string, which implies it's from the ERP (customers table)
    let customer: Customer | ClientCompany | null = null;
    if (typeof companyId === 'string') {
        customer = mainDb.prepare('SELECT * FROM customers WHERE id = ?').get(companyId) as Customer | null;
    } else { // It's a number, so it's from the local client_companies table
        const ticketsDb = await connectDb(TICKETS_DB_FILE);
        customer = ticketsDb.prepare('SELECT * FROM client_companies WHERE id = ?').get(companyId) as ClientCompany | null;
    }
    
    if (!customer) {
        return { customer: null, supportPackage: null, services: [] };
    }

    const customerWithSupportInfo = customer as (Customer | ClientCompany) & { supportPackageId?: string };

    if (!customerWithSupportInfo.supportPackageId) {
        return { customer: JSON.parse(JSON.stringify(customer)), supportPackage: null, services: [] };
    }
    
    const companySettings = await getCompanySettings();
    const supportPackage = companySettings?.supportPackages.find(p => p.id === customerWithSupportInfo.supportPackageId) || null;
    const services = companySettings?.servicesCatalog || [];

    const result = {
        customer: customer,
        supportPackage: supportPackage ? JSON.parse(JSON.stringify(supportPackage)) : null,
        services: JSON.parse(JSON.stringify(services)),
    };

    return JSON.parse(JSON.stringify(result));
}
