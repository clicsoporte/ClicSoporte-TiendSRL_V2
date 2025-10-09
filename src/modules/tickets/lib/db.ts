
/**
 * @fileoverview Server-side functions for the support tickets database.
 */
"use server";

import { connectDb } from '../../core/lib/db';

const TICKETS_DB_FILE = 'tickets.db';

export async function initializeTicketsDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS ticket_customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
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
    // Future migrations for the tickets module will go here.
}
