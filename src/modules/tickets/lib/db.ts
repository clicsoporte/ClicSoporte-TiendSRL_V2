
/**
 * @fileoverview Server-side functions for the support tickets database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { Ticket, NewTicketPayload, User, TicketCustomer, TicketThread } from '@/modules/core/types';

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
            defaultAssigneeId INTEGER,
            slaHours INTEGER
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
    
    console.log(`Database ${TICKETS_DB_FILE} initialized for Support Tickets.`);
    await runTicketMigrations(db);
}

export async function runTicketMigrations(db: import('better-sqlite3').Database) {
    const ticketsTableInfo = db.prepare(`PRAGMA table_info(tickets)`).all() as { name: string }[];
    const ticketsColumns = new Set(ticketsTableInfo.map(c => c.name));

    if (!ticketsColumns.has('customerName')) {
        db.exec(`ALTER TABLE tickets ADD COLUMN customerName TEXT;`);
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

        // If it's not a customer from the ERP, create a new entry in ticket_customers.
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

        const ticketInsertInfo = db.prepare(`
            INSERT INTO tickets (consecutive, subject, status, priority, createdAt, updatedAt, erpCustomerId, ticketCustomerId, customerName, assigneeId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(consecutive, payload.subject, 'open', 'medium', now, now, erpCustomerId, ticketCustomerId, payload.customerName, null);
        
        const newTicketId = ticketInsertInfo.lastInsertRowid;

        const threadInsertInfo = db.prepare(`
            INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(newTicketId, user.id, user.name, 'message', payload.content, now);

        db.prepare('UPDATE ticket_settings SET value = ? WHERE key = ?').run(String(number + 1), 'nextTicketNumber');

        const newTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(newTicketId) as Ticket;
        return newTicket;
    });

    return transaction();
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
