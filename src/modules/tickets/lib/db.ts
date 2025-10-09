

/**
 * @fileoverview Server-side functions for the support tickets database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { Ticket, NewTicketPayload, User, TicketCustomer, TicketThread, HelpTopic } from '@/modules/core/types';

const TICKETS_DB_FILE = 'tickets.db';

export async function initializeTicketsDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS ticket_customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            notes TEXT,
            createdAt TEXT NOT NULL
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
            
            erpCustomerId TEXT, -- From intratool.db customers table
            ticketCustomerId INTEGER, -- From this db's ticket_customers table
            customerName TEXT, -- Denormalized for quick display
            
            assigneeId INTEGER, -- User ID from intratool.db
            helpTopicId INTEGER,

            FOREIGN KEY (ticketCustomerId) REFERENCES ticket_customers(id),
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

    if (!ticketsColumns.has('customerName')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN customerName TEXT;`);
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
        let ticketCustomerId: number | null = null;
        let erpCustomerId: string | null = payload.erpCustomerId;

        if (!erpCustomerId) {
            const existingCustomer = db.prepare('SELECT id FROM ticket_customers WHERE email = ?').get(payload.customerEmail) as { id: number } | undefined;
            if (existingCustomer) {
                ticketCustomerId = existingCustomer.id;
            } else {
                const info = db.prepare('INSERT INTO ticket_customers (name, email, phone, createdAt) VALUES (?, ?, ?, ?)')
                    .run(payload.customerName, payload.customerEmail, payload.customerPhone || null, new Date().toISOString());
                ticketCustomerId = info.lastInsertRowid as number;
            }
        }

        const { prefix, number } = getNextTicketNumber(db);
        const consecutive = `${prefix}${number.toString().padStart(6, '0')}`;
        const now = new Date().toISOString();
        
        let priority = payload.priority;
        let assigneeId = null;

        if (payload.helpTopicId) {
            const topic = db.prepare('SELECT * FROM help_topics WHERE id = ?').get(payload.helpTopicId) as HelpTopic | undefined;
            if (topic) {
                if (topic.defaultPriority) priority = topic.defaultPriority;
                if (topic.defaultAssigneeId) assigneeId = topic.defaultAssigneeId;
            }
        }

        const ticketInsertInfo = db.prepare(`
            INSERT INTO tickets (consecutive, subject, status, priority, createdAt, updatedAt, erpCustomerId, ticketCustomerId, customerName, assigneeId, helpTopicId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(consecutive, payload.subject, 'open', priority, now, now, erpCustomerId, ticketCustomerId, payload.customerName, assigneeId, payload.helpTopicId);
        
        const newTicketId = ticketInsertInfo.lastInsertRowid;

        db.prepare(`
            INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(newTicketId, user.id, user.name, 'message', payload.content, now);

        db.prepare('UPDATE ticket_settings SET value = ? WHERE key = ?').run(String(number + 1), 'nextTicketNumber');

        const newTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(newTicketId) as Ticket;
        return newTicket;
    });

    return transaction();
}

export async function addTicketCustomer(payload: Omit<TicketCustomer, 'id' | 'createdAt' | 'notes'>): Promise<void> {
    const db = await connectDb(TICKETS_DB_FILE);
    const existing = db.prepare('SELECT id FROM ticket_customers WHERE email = ?').get(payload.email);
    if (existing) {
        throw new Error('Ya existe un cliente de soporte con este correo electrónico.');
    }
    db.prepare('INSERT INTO ticket_customers (name, email, phone, createdAt) VALUES (?, ?, ?, ?)')
      .run(payload.name, payload.email, payload.phone || null, new Date().toISOString());
}

export async function getTickets(): Promise<Ticket[]> {
    const db = await connectDb(TICKETS_DB_FILE);
    try {
        const stmt = db.prepare('SELECT * FROM tickets ORDER BY createdAt DESC');
        return stmt.all() as Ticket[];
    } catch (error) {
        console.error("Failed to get tickets:", error);
        return [];
    }
}

export async function getTicketById(id: number): Promise<Ticket | null> {
    const db = await connectDb(TICKETS_DB_FILE);
    try {
        const stmt = db.prepare('SELECT * FROM tickets WHERE id = ?');
        return stmt.get(id) as Ticket | null;
    } catch (error) {
        console.error(`Failed to get ticket with id ${id}:`, error);
        return null;
    }
}

export async function getTicketThread(ticketId: number): Promise<TicketThread[]> {
    const db = await connectDb(TICKETS_DB_FILE);
    try {
        const stmt = db.prepare('SELECT * FROM ticket_threads WHERE ticketId = ? ORDER BY createdAt ASC');
        return stmt.all(ticketId) as TicketThread[];
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
    
    return db.prepare('SELECT * FROM ticket_threads WHERE id = ?').get(info.lastInsertRowid) as TicketThread;
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
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
}

export async function getHelpTopics(): Promise<HelpTopic[]> {
    const db = await connectDb(TICKETS_DB_FILE);
    try {
        return db.prepare('SELECT * FROM help_topics ORDER BY name ASC').all() as HelpTopic[];
    } catch (error) {
        console.error("Failed to get help topics:", error);
        return [];
    }
}

export async function addHelpTopic(topic: Omit<HelpTopic, 'id'>): Promise<HelpTopic> {
    const db = await connectDb(TICKETS_DB_FILE);
    const info = db.prepare('INSERT INTO help_topics (name, defaultPriority, defaultAssigneeId) VALUES (?, ?, ?)').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId);
    return db.prepare('SELECT * FROM help_topics WHERE id = ?').get(info.lastInsertRowid) as HelpTopic;
}

export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('UPDATE help_topics SET name = ?, defaultPriority = ?, defaultAssigneeId = ? WHERE id = ?').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.id);
    return topic;
}

export async function deleteHelpTopic(id: number): Promise<void> {
    const db = await connectDb(TICKETS_DB_FILE);
    db.prepare('DELETE FROM help_topics WHERE id = ?').run(id);
}
