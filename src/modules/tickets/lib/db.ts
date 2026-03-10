/**
 * @fileoverview Server-side functions for the support tickets database.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from '@/modules/core/lib/db-connection';
import { getCompanySettings } from '../../core/lib/settings-db';
import type { Ticket, NewTicketPayload, User, TicketThread, HelpTopic, ClientCompany, SupportPackage, Service, ThirdPartyProvider } from '@/modules/core/types';

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
            contractId INTEGER,
            isBillable INTEGER DEFAULT 0,
            providerId INTEGER,
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

        CREATE TABLE IF NOT EXISTS third_party_providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            specialty TEXT,
            notes TEXT,
            createdAt TEXT NOT NULL
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
    if (!columns.has('contractId')) db.exec(`ALTER TABLE tickets ADD COLUMN contractId INTEGER;`);
    if (!columns.has('isBillable')) db.exec(`ALTER TABLE tickets ADD COLUMN isBillable INTEGER DEFAULT 0;`);
    if (!columns.has('providerId')) db.exec(`ALTER TABLE tickets ADD COLUMN providerId INTEGER;`);

    const hasProvidersTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='third_party_providers'`).get();
    if (!hasProvidersTable) {
        db.exec(`
            CREATE TABLE third_party_providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                specialty TEXT,
                notes TEXT,
                createdAt TEXT NOT NULL
            );
        `);
    }
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
            INSERT INTO tickets (consecutive, subject, status, priority, createdAt, updatedAt, companyId, customerName, companyName, assigneeId, helpTopicId, serviceId, dueDate, contractId, isBillable, providerId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(consecutive, payload.subject, 'open', priority, now, now, payload.companyId, payload.customerName, companyName, assigneeId, payload.helpTopicId, payload.serviceId, payload.dueDate || null, payload.contractId, payload.isBillable ? 1 : 0, payload.providerId);
        
        db.prepare('INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
          .run(info.lastInsertRowid, user.id, user.name, 'message', payload.content, now);

        db.prepare('UPDATE ticket_settings SET value = ? WHERE key = ?').run(String(number + 1), 'nextTicketNumber');
        return db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid) as Ticket;
    });

    const result = transaction() as Ticket;
    return {
        ...result,
        isBillable: !!result.isBillable
    };
}

export async function addClientCompany(payload: Omit<ClientCompany, 'id' | 'createdAt'>): Promise<ClientCompany> {
    const db = await connectTicketsDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO client_companies (name, taxId, address, phone, email, createdAt) VALUES (@name, @taxId, @address, @phone, @email, @createdAt)`).run({ ...payload, createdAt: now });
    return { ...payload, id: Number(info.lastInsertRowid), createdAt: now };
}

export async function updateClientCompany(payload: ClientCompany): Promise<ClientCompany> {
    const db = await connectTicketsDb();
    db.prepare(`UPDATE client_companies SET name = @name, taxId = @taxId, address = @address, phone = @phone, email = @email WHERE id = @id`).run(payload);
    return payload;
}

export async function deleteClientCompany(id: number): Promise<void> {
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM client_companies WHERE id = ?').run(id);
}

export async function getClientCompanies(): Promise<ClientCompany[]> {
    const db = await connectTicketsDb();
    return db.prepare('SELECT * FROM client_companies ORDER BY name ASC').all() as ClientCompany[];
}

export async function getTickets(): Promise<Ticket[]> {
    const db = await connectTicketsDb();
    const rows = db.prepare('SELECT * FROM tickets ORDER BY createdAt DESC').all() as Ticket[];
    return rows.map(r => ({ ...r, isBillable: !!r.isBillable }));
}

export async function getTicketById(id: number): Promise<Ticket | null> {
    const db = await connectTicketsDb();
    const result = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Ticket | undefined;
    return result ? { ...result, isBillable: !!result.isBillable } : null;
}

export async function getTicketThread(ticketId: number): Promise<TicketThread[]> {
    const db = await connectTicketsDb();
    return db.prepare('SELECT * FROM ticket_threads WHERE ticketId = ? ORDER BY createdAt ASC').all(ticketId) as TicketThread[];
}

export async function addThreadEntry(payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' | 'status_change' }): Promise<TicketThread> {
    const db = await connectTicketsDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(payload.ticketId, payload.userId, payload.userName, payload.type, payload.content, now);
    db.prepare('UPDATE tickets SET updatedAt = ? WHERE id = ?').run(now, payload.ticketId);
    return db.prepare('SELECT * FROM ticket_threads WHERE id = ?').get(info.lastInsertRowid) as TicketThread;
}

export async function updateTicketDetails(ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'isBillable' | 'providerId'>>, user: User): Promise<Ticket> {
    const db = await connectTicketsDb();
    const currentTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
    if (!currentTicket) throw new Error("Ticket not found.");
    
    const transaction = db.transaction(() => {
        const now = new Date().toISOString();
        let query = 'UPDATE tickets SET updatedAt = ?';
        const params: (string | number | null)[] = [now];
        const notes: string[] = [];

        if (updates.status && updates.status !== currentTicket.status) { query += ', status = ?'; params.push(updates.status); notes.push(`Estado: ${updates.status}`); }
        if (updates.priority && updates.priority !== currentTicket.priority) { query += ', priority = ?'; params.push(updates.priority); notes.push(`Prioridad: ${updates.priority}`); }
        if (updates.assigneeId !== undefined && updates.assigneeId !== currentTicket.assigneeId) { query += ', assigneeId = ?'; params.push(updates.assigneeId); notes.push(`Asignado`); }
        if (updates.isBillable !== undefined && !!updates.isBillable !== !!currentTicket.isBillable) { query += ', isBillable = ?'; params.push(updates.isBillable ? 1 : 0); notes.push(`Facturación: ${updates.isBillable ? 'Facturable' : 'No facturable'}`); }
        if (updates.providerId !== undefined && updates.providerId !== currentTicket.providerId) { query += ', providerId = ?'; params.push(updates.providerId); notes.push(`Proveedor externo actualizado`); }
        
        query += ' WHERE id = ?';
        params.push(ticketId);

        if (params.length > 2) {
            db.prepare(query).run(...params);
            db.prepare(`INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
              .run(ticketId, user.id, user.name, 'status_change', notes.join('. '), now);
        }
        return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
    });

    const result = transaction() as Ticket;
    return { ...result, isBillable: !!result.isBillable };
}

export async function getHelpTopics(): Promise<HelpTopic[]> {
    const db = await connectTicketsDb();
    return db.prepare('SELECT * FROM help_topics ORDER BY name ASC').all() as HelpTopic[];
}

export async function addHelpTopic(topic: Omit<HelpTopic, 'id'>): Promise<HelpTopic> {
    const db = await connectTicketsDb();
    const info = db.prepare('INSERT INTO help_topics (name, defaultPriority, defaultAssigneeId, defaultServiceId) VALUES (?, ?, ?, ?)').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.defaultServiceId);
    return db.prepare('SELECT * FROM help_topics WHERE id = ?').get(info.lastInsertRowid) as HelpTopic;
}

export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    const db = await connectTicketsDb();
    db.prepare('UPDATE help_topics SET name = ?, defaultPriority = ?, defaultAssigneeId = ?, defaultServiceId = ? WHERE id = ?').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.defaultServiceId, topic.id);
    return db.prepare('SELECT * FROM help_topics WHERE id = ?').get(topic.id) as HelpTopic;
}

export async function deleteHelpTopic(id: number): Promise<void> {
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM help_topics WHERE id = ?').run(id);
}

export async function deleteTicket(id: number): Promise<void> {
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
}

export async function getCustomerSupportInfo(companyId: number | string): Promise<{ customer: Record<string, unknown> | null; supportPackage: SupportPackage | null, services: Service[] }> {
    const db = await connectTicketsDb();
    let customer: Record<string, unknown> | null = null;
    if (typeof companyId === 'string') {
        const mainDb = await baseConnectDb('intratool.db');
        customer = mainDb.prepare('SELECT * FROM customers WHERE id = ?').get(companyId) as Record<string, unknown> | null;
    } else {
        customer = db.prepare('SELECT * FROM client_companies WHERE id = ?').get(companyId) as Record<string, unknown> | null;
    }
    
    if (!customer) return { customer: null, supportPackage: null, services: [] };
    const settings = await getCompanySettings();
    const pkgId = customer.supportPackageId as string | undefined;
    const pkg = settings.supportPackages.find(p => p.id === pkgId) || null;
    return { customer, supportPackage: pkg, services: settings.servicesCatalog };
}

// --- Third Party Providers Actions ---
export async function getThirdPartyProviders(): Promise<ThirdPartyProvider[]> {
    const db = await connectTicketsDb();
    return db.prepare('SELECT * FROM third_party_providers ORDER BY name ASC').all() as ThirdPartyProvider[];
}

export async function addThirdPartyProvider(payload: Omit<ThirdPartyProvider, 'id' | 'createdAt'>): Promise<ThirdPartyProvider> {
    const db = await connectTicketsDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO third_party_providers (name, email, phone, specialty, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(payload.name, payload.email, payload.phone, payload.specialty, payload.notes, now);
    return { ...payload, id: Number(info.lastInsertRowid), createdAt: now };
}

export async function updateThirdPartyProvider(payload: ThirdPartyProvider): Promise<ThirdPartyProvider> {
    const db = await connectTicketsDb();
    db.prepare(`UPDATE third_party_providers SET name = ?, email = ?, phone = ?, specialty = ?, notes = ? WHERE id = ?`).run(payload.name, payload.email, payload.phone, payload.specialty, payload.notes, payload.id);
    return payload;
}

export async function deleteThirdPartyProvider(id: number): Promise<void> {
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM third_party_providers WHERE id = ?').run(id);
}
