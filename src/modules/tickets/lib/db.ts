/**
 * @fileoverview Server-side functions for the support tickets database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { Ticket, NewTicketPayload, User, TicketCustomer, TicketThread, HelpTopic, ClientCompany } from '@/modules/core/types';
import crypto from 'crypto';

const TICKETS_DB_FILE = 'tickets.db';

export async function initializeTicketsDb(db: import('better-sqlite3').Database) {
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
            defaultAssigneeId INTEGER
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
            
            contactId INTEGER,
            
            -- Denormalized for quick display & for customers not in the company structure
            customerName TEXT, 
            companyName TEXT, 

            assigneeId INTEGER, -- User ID from intratool.db
            helpTopicId INTEGER,

            FOREIGN KEY (contactId) REFERENCES company_contacts(id) ON DELETE SET NULL,
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
        { id: 1, name: 'Soporte General', defaultPriority: 'medium', defaultAssigneeId: null },
        { id: 2, name: 'Consulta de Facturación', defaultPriority: 'medium', defaultAssigneeId: null },
        { id: 3, name: 'Problema con Impresora', defaultPriority: 'high', defaultAssigneeId: null }
    ];
    const insertTopic = db.prepare('INSERT OR IGNORE INTO help_topics (id, name, defaultPriority, defaultAssigneeId) VALUES (@id, @name, @defaultPriority, @defaultAssigneeId)');
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
                    contactId INTEGER,
                    customerName TEXT,
                    companyName TEXT,
                    assigneeId INTEGER,
                    helpTopicId INTEGER,
                    FOREIGN KEY (contactId) REFERENCES company_contacts(id) ON DELETE SET NULL,
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
    if (!helpTopicsTable) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS help_topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                defaultPriority TEXT,
                defaultAssigneeId INTEGER
            );
        `);
        // Populate with some defaults if it didn't exist
        const topics = [
            { id: 1, name: 'Soporte General', defaultPriority: 'medium', defaultAssigneeId: null },
            { id: 2, name: 'Consulta de Facturación', defaultPriority: 'medium', defaultAssigneeId: null },
            { id: 3, name: 'Problema con Impresora', defaultPriority: 'high', defaultAssigneeId: null }
        ];
        const insertTopic = db.prepare('INSERT OR IGNORE INTO help_topics (id, name, defaultPriority, defaultAssigneeId) VALUES (@id, @name, @defaultPriority, @defaultAssigneeId)');
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

    const transaction = db.transaction(() => {
        const { prefix, number } = getNextTicketNumber.call({db: db}) as { prefix: string, number: number };
        const consecutive = `${prefix}${number.toString().padStart(6, '0')}`;
        const now = new Date().toISOString();
        
        let priority = payload.priority;
        let assigneeId = payload.assigneeId;

        if (payload.helpTopicId) {
            const topic = db.prepare('SELECT * FROM help_topics WHERE id = ?').get(payload.helpTopicId) as HelpTopic | undefined;
            if (topic) {
                if (topic.defaultPriority && !payload.priority) priority = topic.defaultPriority;
                if (topic.defaultAssigneeId && payload.assigneeId === undefined) assigneeId = topic.defaultAssigneeId;
            }
        }
        
        // Find company name if contactId is provided
        let companyName = payload.companyName || '';
        if(payload.contactId) {
            const contact = db.prepare('SELECT companyId FROM company_contacts WHERE id = ?').get(payload.contactId) as { companyId: number } | undefined;
            if (contact) {
                const company = db.prepare('SELECT name FROM client_companies WHERE id = ?').get(contact.companyId) as { name: string } | undefined;
                if(company) companyName = company.name;
            }
        }

        const ticketInsertInfo = db.prepare(`
            INSERT INTO tickets (consecutive, subject, status, priority, createdAt, updatedAt, contactId, customerName, companyName, assigneeId, helpTopicId, dueDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(consecutive, payload.subject, 'open', priority, now, now, payload.contactId, payload.customerName, companyName, assigneeId, payload.helpTopicId, payload.dueDate || null);
        
        const newTicketId = ticketInsertInfo.lastInsertRowid;

        db.prepare(`
            INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(newTicketId, user.id, user.name, 'message', payload.content, now);

        db.prepare('UPDATE ticket_settings SET value = ? WHERE key = ?').run(String(number + 1), 'nextTicketNumber');

        const newTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(newTicketId) as Ticket;
        return newTicket;
    });

    return JSON.parse(JSON.stringify(transaction()));
}

export async function addTicketCustomer(payload: Omit<TicketCustomer, 'id' | 'createdAt' | 'notes'>): Promise<TicketCustomer> {
    const db = await connectDb(TICKETS_DB_FILE);
    const existing = db.prepare('SELECT id FROM company_contacts WHERE email = ?').get(payload.email);
    if (existing) {
        throw new Error('Ya existe un contacto de soporte con este correo electrónico.');
    }
    
    // For standalone customers, we create a 'company' entry for them.
    const company = {
        name: payload.name,
        taxId: payload.email, // Using email as unique ID for now for standalone customers.
        address: '',
        phone: payload.phone || '',
        email: payload.email,
        createdAt: new Date().toISOString()
    }
    
    const companyInfo = db.prepare('INSERT INTO client_companies (name, taxId, address, phone, email, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(company.name, company.taxId, company.address, company.phone, company.email, company.createdAt);
    const companyId = companyInfo.lastInsertRowid as number;

    const contactInfo = db.prepare('INSERT INTO company_contacts (companyId, name, email, phone, isPrimary, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(companyId, payload.name, payload.email, payload.phone || null, true, new Date().toISOString());

    const result = {
        id: contactInfo.lastInsertRowid as number,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        createdAt: company.createdAt
    };
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

export async function getTicketCustomerById(id: number): Promise<TicketCustomer | null> {
    // This function will need to be adapted to the new company/contact structure
    // For now, it will fetch from a placeholder.
    return null;
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

        if (updates) {
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
    const info = db.prepare('INSERT INTO help_topics (name, defaultPriority, defaultAssigneeId) VALUES (?, ?, ?)').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId);
    const result = db.prepare('SELECT * FROM help_topics WHERE id = ?').get(info.lastInsertRowid) as HelpTopic;
    return JSON.parse(JSON.stringify(result));
}

export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('UPDATE help_topics SET name = ?, defaultPriority = ?, defaultAssigneeId = ? WHERE id = ?').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.id);
    return JSON.parse(JSON.stringify(topic));
}

export async function deleteHelpTopic(id: number): Promise<void> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('DELETE FROM help_topics WHERE id = ?').run(id);
}

export async function deleteTicket(id: number): Promise<void> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
}
