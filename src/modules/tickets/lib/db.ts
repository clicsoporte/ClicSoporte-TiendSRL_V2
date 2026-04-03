/**
 * @fileoverview Server-side functions for the support tickets module.
 * Unified into intratool.db.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb } from '@/modules/core/lib/db';
import { logError } from '@/modules/core/lib/logger';
import { getCompanySettings } from '@/modules/core/lib/settings-db';
import type { Ticket, NewTicketPayload, User, TicketThread, HelpTopic, ClientCompany, SupportPackage, Service, ThirdPartyProvider } from '@/modules/core/types';

export async function connectTicketsDb(): Promise<Database> {
    return connectDb();
}

async function getNextTicketNumber(db: Database): Promise<{ prefix: string; number: number }> {
    const prefixRow = db.prepare("SELECT value FROM ticket_settings WHERE key = 'ticketPrefix'").get() as { value: string } | undefined;
    const numberRow = db.prepare("SELECT value FROM ticket_settings WHERE key = 'nextTicketNumber'").get() as { value: string } | undefined;
    return { prefix: prefixRow?.value || 'CAS-', number: numberRow ? parseInt(numberRow.value, 10) : 1 };
}

export async function addTicket(payload: NewTicketPayload, user: User): Promise<Ticket> {
    try {
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
        return { ...result, isBillable: !!result.isBillable };
    } catch (error: unknown) {
        const err = error as Error;
        await logError("Falla al abrir ticket de soporte", { error: err.message, subject: payload.subject });
        throw new Error(`No se pudo crear el ticket: ${err.message}`);
    }
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

        // Workflow logic: Sync Timer with Status
        if (updates.status && updates.status !== currentTicket.status) {
            query += ', status = ?';
            params.push(updates.status);
            notes.push(`Estado: ${updates.status}`);

            // 1. If moving TO in_progress, start a new timer entry if none exists
            if (updates.status === 'in_progress') {
                const running = db.prepare('SELECT id FROM time_entries WHERE ticketId = ? AND endTime IS NULL').get(ticketId);
                if (!running) {
                    db.prepare(`
                        INSERT INTO time_entries (ticketId, userId, startTime, isBillable, billingStatus, createdAt)
                        VALUES (?, ?, ?, ?, 'pending', ?)
                    `).run(ticketId, user.id, now, currentTicket.isBillable ? 1 : 0, now);
                }
            }

            // 2. If moving TO on_hold, completed, or canceled, stop any running timer
            if (['on_hold', 'completed', 'canceled'].includes(updates.status)) {
                const active = db.prepare('SELECT * FROM time_entries WHERE ticketId = ? AND endTime IS NULL').get(ticketId) as any;
                if (active) {
                    const start = new Date(active.startTime).getTime();
                    const end = new Date(now).getTime();
                    const duration = end - start;
                    db.prepare('UPDATE time_entries SET endTime = ?, duration = ?, billableDuration = ? WHERE id = ?')
                      .run(now, duration, duration, active.id);
                }
            }
        }

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
        customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(companyId) as Record<string, unknown> | null;
    } else {
        customer = db.prepare('SELECT * FROM client_companies WHERE id = ?').get(companyId) as Record<string, unknown> | null;
    }
    if (!customer) return { customer: null, supportPackage: null, services: [] };
    const settings = await getCompanySettings();
    const pkgId = customer.supportPackageId as string | undefined;
    const pkg = settings.supportPackages.find((p: SupportPackage) => p.id === pkgId) || null;
    return { customer, supportPackage: pkg, services: settings.servicesCatalog };
}

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
