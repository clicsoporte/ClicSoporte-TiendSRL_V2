
/**
 * @fileoverview Server-side functions for the support tickets database.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from '@/modules/core/lib/db-connection';
import { getCompanySettings } from '../../core/lib/settings-db';
import type { Ticket, NewTicketPayload, User, TicketThread, HelpTopic, ClientCompany, SupportPackage, Service, Customer } from '@/modules/core/types';

const TICKETS_DB_FILE = 'tickets.db';

export async function connectTicketsDb(): Promise<Database> {
    return baseConnectDb(TICKETS_DB_FILE, initializeTicketsDb, runTicketMigrations);
}

export async function initializeTicketsDb(db: Database): Promise<void> {
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
            companyName TEXT,
            assigneeId INTEGER,
            helpTopicId INTEGER,
            serviceId TEXT,
            FOREIGN KEY (companyId) REFERENCES client_companies(id) ON DELETE SET NULL,
            FOREIGN KEY (helpTopicId) REFERENCES help_topics(id)
        );

        CREATE TABLE IF NOT EXISTS ticket_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketId INTEGER NOT NULL,
            userId INTEGER,
            userName TEXT,
            type TEXT NOT NULL,
            content TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ticket_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `;
    db.exec(schema);

    db.prepare(`INSERT OR IGNORE INTO ticket_settings (key, value) VALUES ('ticketPrefix', 'CAS-')`).run();
    db.prepare(`INSERT OR IGNORE INTO ticket_settings (key, value) VALUES ('nextTicketNumber', '1')`).run();

    const topics = [
        { id: 1, name: 'Soporte General', defaultPriority: 'medium', defaultAssigneeId: null, defaultServiceId: null },
        { id: 2, name: 'Consulta de Facturación', defaultPriority: 'medium', defaultAssigneeId: null, defaultServiceId: null },
        { id: 3, name: 'Problema con Impresora', defaultPriority: 'high', defaultAssigneeId: null, defaultServiceId: null }
    ];
    const insertTopic = db.prepare('INSERT OR IGNORE INTO help_topics (id, name, defaultPriority, defaultAssigneeId, defaultServiceId) VALUES (@id, @name, @defaultPriority, @defaultAssigneeId, @defaultServiceId)');
    topics.forEach(topic => insertTopic.run(topic));
}

export async function runTicketMigrations(db: Database) {
    const tableInfo = db.prepare(`PRAGMA table_info(tickets)`).all() as { name: string }[];
    const columns = new Set(tableInfo.map(c => c.name));
    if (!columns.has('companyName')) db.exec(`ALTER TABLE tickets ADD COLUMN companyName TEXT;`);
    if (!columns.has('helpTopicId')) db.exec(`ALTER TABLE tickets ADD COLUMN helpTopicId INTEGER;`);
    if (!columns.has('serviceId')) db.exec(`ALTER TABLE tickets ADD COLUMN serviceId TEXT;`);
    if (!columns.has('dueDate')) db.exec(`ALTER TABLE tickets ADD COLUMN dueDate TEXT;`);
}

async function getNextTicketNumber(db: Database): Promise<{ prefix: string; number: number }> {
    const prefixRow = db.prepare("SELECT value FROM ticket_settings WHERE key = 'ticketPrefix'").get() as { value: string } | undefined;
    const numberRow = db.prepare("SELECT value FROM ticket_settings WHERE key = 'nextTicketNumber'").get() as { value: string } | undefined;
    return { prefix: prefixRow?.value || 'CAS-', number: numberRow ? parseInt(numberRow.value, 10) : 1 };
}

export async function addTicket(payload: NewTicketPayload, user: User): Promise<Ticket> {
    const db = await connectTicketsDb();
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
        
        let companyName = payload.companyName || '';
        if(payload.companyId) {
            const company = db.prepare('SELECT name FROM client_companies WHERE id = ?').get(payload.companyId) as { name: string } | undefined;
            if(company) companyName = company.name;
        }

        const info = db.prepare(`
            INSERT INTO tickets (consecutive, subject, status, priority, createdAt, updatedAt, companyId, customerName, companyName, assigneeId, helpTopicId, serviceId, dueDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(consecutive, payload.subject, 'open', priority, now, now, payload.companyId, payload.customerName, companyName, assigneeId, payload.helpTopicId, payload.serviceId, payload.dueDate || null);
        
        db.prepare('INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
          .run(info.lastInsertRowid, user.id, user.name, 'message', payload.content, now);

        db.prepare('UPDATE ticket_settings SET value = ? WHERE key = ?').run(String(number + 1), 'nextTicketNumber');
        return db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid) as Ticket;
    });

    return JSON.parse(JSON.stringify(transaction()));
}

export async function addClientCompany(payload: Omit<ClientCompany, 'id' | 'createdAt'>): Promise<ClientCompany> {
    const db = await connectTicketsDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO client_companies (name, taxId, address, phone, email, createdAt) VALUES (@name, @taxId, @address, @phone, @email, @createdAt)`).run({ ...payload, createdAt: now });
    return JSON.parse(JSON.stringify({ ...payload, id: info.lastInsertRowid, createdAt: now }));
}

export async function updateClientCompany(payload: ClientCompany): Promise<ClientCompany> {
    const db = await connectTicketsDb();
    db.prepare(`UPDATE client_companies SET name = @name, taxId = @taxId, address = @address, phone = @phone, email = @email WHERE id = @id`).run(payload);
    return JSON.parse(JSON.stringify(payload));
}

export async function deleteClientCompany(id: number): Promise<void> {
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM client_companies WHERE id = ?').run(id);
}

export async function getClientCompanies(): Promise<ClientCompany[]> {
    const db = await connectTicketsDb();
    return JSON.parse(JSON.stringify(db.prepare('SELECT * FROM client_companies ORDER BY name ASC').all()));
}

export async function getTickets(): Promise<Ticket[]> {
    const db = await connectTicketsDb();
    return JSON.parse(JSON.stringify(db.prepare('SELECT * FROM tickets ORDER BY createdAt DESC').all()));
}

export async function getTicketById(id: number): Promise<Ticket | null> {
    const db = await connectTicketsDb();
    const result = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    return result ? JSON.parse(JSON.stringify(result)) : null;
}

export async function getTicketThread(ticketId: number): Promise<TicketThread[]> {
    const db = await connectTicketsDb();
    return JSON.parse(JSON.stringify(db.prepare('SELECT * FROM ticket_threads WHERE ticketId = ? ORDER BY createdAt ASC').all(ticketId)));
}

export async function addThreadEntry(payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' }): Promise<TicketThread> {
    const db = await connectTicketsDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(payload.ticketId, payload.userId, payload.userName, payload.type, payload.content, now);
    db.prepare('UPDATE tickets SET updatedAt = ? WHERE id = ?').run(now, payload.ticketId);
    return JSON.parse(JSON.stringify(db.prepare('SELECT * FROM ticket_threads WHERE id = ?').get(info.lastInsertRowid)));
}

export async function updateTicketDetails(ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId'>>, user: User): Promise<Ticket> {
    const db = await connectTicketsDb();
    const currentTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
    if (!currentTicket) throw new Error("Ticket not found.");
    
    const transaction = db.transaction(() => {
        const now = new Date().toISOString();
        let query = 'UPDATE tickets SET updatedAt = ?';
        const params: any[] = [now];
        const notes: string[] = [];

        if (updates.status && updates.status !== currentTicket.status) { query += ', status = ?'; params.push(updates.status); notes.push(`Estado: ${updates.status}`); }
        if (updates.priority && updates.priority !== currentTicket.priority) { query += ', priority = ?'; params.push(updates.priority); notes.push(`Prioridad: ${updates.priority}`); }
        if (updates.assigneeId !== undefined && updates.assigneeId !== currentTicket.assigneeId) { query += ', assigneeId = ?'; params.push(updates.assigneeId); notes.push(`Asignado`); }
        
        query += ' WHERE id = ?';
        params.push(ticketId);

        if (params.length > 2) {
            db.prepare(query).run(...params);
            db.prepare(`INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
              .run(ticketId, user.id, user.name, 'status_change', notes.join('. '), now);
        }
        return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
    });

    return JSON.parse(JSON.stringify(transaction()));
}

export async function getHelpTopics(): Promise<HelpTopic[]> {
    const db = await connectTicketsDb();
    return JSON.parse(JSON.stringify(db.prepare('SELECT * FROM help_topics ORDER BY name ASC').all()));
}

export async function addHelpTopic(topic: Omit<HelpTopic, 'id'>): Promise<HelpTopic> {
    const db = await connectTicketsDb();
    const info = db.prepare('INSERT INTO help_topics (name, defaultPriority, defaultAssigneeId, defaultServiceId) VALUES (?, ?, ?, ?)').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.defaultServiceId);
    return JSON.parse(JSON.stringify(db.prepare('SELECT * FROM help_topics WHERE id = ?').get(info.lastInsertRowid)));
}

export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    const db = await connectTicketsDb();
    db.prepare('UPDATE help_topics SET name = ?, defaultPriority = ?, defaultAssigneeId = ?, defaultServiceId = ? WHERE id = ?').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.defaultServiceId, topic.id);
    return JSON.parse(JSON.stringify(db.prepare('SELECT * FROM help_topics WHERE id = ?').get(topic.id)));
}

export async function deleteHelpTopic(id: number): Promise<void> {
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM help_topics WHERE id = ?').run(id);
}

export async function deleteTicket(id: number): Promise<void> {
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
}

export async function getCustomerSupportInfo(companyId: number | string): Promise<{ customer: any; supportPackage: SupportPackage | null, services: Service[] }> {
    const db = await connectTicketsDb();
    let customer: any = null;
    if (typeof companyId === 'string') {
        const mainDb = await baseConnectDb('intratool.db');
        customer = mainDb.prepare('SELECT * FROM customers WHERE id = ?').get(companyId);
    } else {
        customer = db.prepare('SELECT * FROM client_companies WHERE id = ?').get(companyId);
    }
    
    if (!customer) return { customer: null, supportPackage: null, services: [] };
    const settings = await getCompanySettings();
    const pkg = settings.supportPackages.find(p => p.id === customer.supportPackageId) || null;
    return JSON.parse(JSON.stringify({ customer, supportPackage: pkg, services: settings.servicesCatalog }));
}
