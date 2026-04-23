
/**
 * @fileoverview Server-side functions for the support tickets module.
 * Unified into intratool.db. Tables prefixed with ticket_.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb } from '@/modules/core/lib/db';
import { logError } from '@/modules/core/lib/logger';
import { getCompanySettings } from '@/modules/core/lib/settings-db';
import { authorizeAction } from '@/modules/core/lib/auth-guard';
import { triggerNotificationEvent } from '@/modules/notifications/lib/notifications-engine';
import { format, parseISO } from 'date-fns';
import type { Ticket, NewTicketPayload, User, TicketThread, HelpTopic, ClientCompany, SupportPackage, Service, ThirdPartyProvider, ProviderService, ProviderGeoRate, Province, Canton, District, License } from '@/modules/core/types';

/**
 * Interface representing a Ticket row as it comes from the database.
 */
interface DbTicketRow extends Omit<Ticket, 'isBillable' | 'hasActiveTimer' | 'totalDuration'> {
    isBillable: number;
    hasActiveTimer?: number;
    totalDuration?: number;
}

const statusLabels: Record<string, string> = {
    open: 'Abierto',
    in_progress: 'En Progreso',
    on_hold: 'En Espera',
    completed: 'Completado',
    canceled: 'Cancelado'
};

const priorityLabels: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente'
};

export async function connectTicketsDb(): Promise<Database> {
    return connectDb();
}

async function getNextTicketNumberInternal(db: Database): Promise<{ prefix: string; number: number }> {
    const prefixRow = db.prepare("SELECT value FROM ticket_settings WHERE key = 'ticketPrefix'").get() as { value: string } | undefined;
    const numberRow = db.prepare("SELECT value FROM ticket_settings WHERE key = 'nextTicketNumber'").get() as { value: string } | undefined;
    return { prefix: prefixRow?.value || 'CAS-', number: numberRow ? parseInt(numberRow.value, 10) : 1 };
}

export async function addTicket(payload: NewTicketPayload, user: User): Promise<Ticket> {
    await authorizeAction('tickets:create');
    try {
        const db = await connectTicketsDb();
        
        const customer = db.prepare("SELECT isBlocked, blockedReason FROM customers WHERE name = ? OR commercialName = ?").get(payload.customerName, payload.customerName) as { isBlocked: number, blockedReason: string } | undefined;
        if (customer && customer.isBlocked === 1) {
            throw new Error(`OPERACIÓN DENEGADA: El cliente se encuentra BLOQUEADO por razones administrativas. Motivo: ${customer.blockedReason || 'Sin especificar'}`);
        }

        const { prefix, number } = await getNextTicketNumberInternal(db);

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
                INSERT INTO tickets (consecutive, subject, status, priority, createdAt, updatedAt, companyId, customerName, customerEmail, customerPhone, companyName, assigneeId, helpTopicId, serviceId, dueDate, contractId, licenseId, equipmentId, isBillable, providerId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(consecutive, payload.subject, 'open', priority, now, now, payload.companyId, payload.customerName, payload.customerEmail, payload.customerPhone || null, companyName, assigneeId, payload.helpTopicId, payload.serviceId, payload.dueDate || null, payload.contractId, payload.licenseId || null, payload.equipmentId || null, payload.isBillable ? 1 : 0, payload.providerId);
            
            db.prepare('INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
              .run(info.lastInsertRowid, user.id, user.name, 'message', payload.content, now);

            db.prepare('UPDATE ticket_settings SET value = ? WHERE key = ?').run(String(number + 1), 'nextTicketNumber');
            return db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid) as DbTicketRow;
        });

        const result = transaction() as DbTicketRow;

        try {
            const settings = await getCompanySettings();
            const service = settings.servicesCatalog.find(s => s.id === result.serviceId);
            
            let assigneeName = 'Sin asignar';
            if (result.assigneeId) {
                const assignee = db.prepare('SELECT name FROM users WHERE id = ?').get(result.assigneeId) as { name: string } | undefined;
                if (assignee) assigneeName = assignee.name;
            }

            const formattedPrice = service ? `¢${(service.price || 0).toLocaleString()} ${service.billingType === 'task' ? '(Monto Fijo)' : '/ h'}` : '';

            await triggerNotificationEvent('onTicketCreated', {
                ...result,
                serviceName: service?.name || 'No especificado',
                assigneeName: assigneeName,
                formattedDateTime: format(parseISO(result.createdAt), 'dd/MM/yyyy HH:mm'),
                status: statusLabels[result.status] || result.status,
                priority: priorityLabels[result.priority] || result.priority,
                customerEmail: result.customerEmail,
                isBillable: result.isBillable === 1,
                formattedPrice
            });

            if (result.priority === 'urgent') {
                await triggerNotificationEvent('onTicketPriorityUrgent', {
                    ...result,
                    status: statusLabels[result.status] || result.status,
                    priority: priorityLabels[result.priority] || result.priority
                });
            }
        } catch (notifErr) {
            console.error("Failed to trigger onTicketCreated notifications:", notifErr);
        }

        return JSON.parse(JSON.stringify({ ...result, isBillable: result.isBillable === 1 }));
    } catch (error: unknown) {
        const err = error as Error;
        await logError("Falla al abrir ticket de soporte", { error: err.message, subject: payload.subject });
        throw new Error(err.message || "No se pudo crear el ticket.");
    }
}

export async function addClientCompany(payload: Omit<ClientCompany, 'id' | 'createdAt'>): Promise<ClientCompany> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO client_companies (name, taxId, address, phone, email, createdAt) VALUES (@name, @taxId, @address, @phone, @email, @createdAt)`).run({ ...payload, createdAt: now });
    return JSON.parse(JSON.stringify({ ...payload, id: Number(info.lastInsertRowid), createdAt: now }));
}

export async function updateClientCompany(payload: ClientCompany): Promise<ClientCompany> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare(`UPDATE client_companies SET name = @name, taxId = @taxId, address = @address, phone = @phone, email = @email WHERE id = @id`).run(payload);
    return JSON.parse(JSON.stringify(payload));
}

export async function deleteClientCompany(id: number): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM client_companies WHERE id = ?').run(id);
}

export async function getClientCompanies(): Promise<ClientCompany[]> {
    const db = await connectTicketsDb();
    const rows = db.prepare('SELECT * FROM client_companies ORDER BY name ASC').all() as ClientCompany[];
    return JSON.parse(JSON.stringify(rows));
}

/**
 * Retrieves tickets with pagination and server-side filtering.
 */
export async function getTickets(
    page: number = 1, 
    limit: number = 20, 
    filters: { search?: string, status?: string, priority?: string, assigneeId?: number | null } = {}
): Promise<{ data: Ticket[], hasMore: boolean }> {
    const db = await connectTicketsDb();
    const offset = (page - 1) * limit;
    const { search, status, priority, assigneeId } = filters;

    try {
        const whereClauses: string[] = [];
        const params: (string | number)[] = [];

        if (search?.trim()) {
            whereClauses.push("(t.consecutive LIKE ? OR t.subject LIKE ? OR t.customerName LIKE ? OR t.companyName LIKE ?)");
            const searchParam = `%${search.trim()}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        if (status && status !== 'all') {
            whereClauses.push("t.status = ?");
            params.push(status);
        }

        if (priority && priority !== 'all') {
            whereClauses.push("t.priority = ?");
            params.push(priority);
        }

        if (assigneeId !== undefined && assigneeId !== null) {
            whereClauses.push("t.assigneeId = ?");
            params.push(assigneeId);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT t.*, 
                   COALESCE(SUM(te.duration), 0) as totalDuration,
                   MAX(CASE WHEN te.endTime IS NULL THEN 1 ELSE 0 END) as hasActiveTimer
            FROM tickets t
            LEFT JOIN time_entries te ON t.id = te.ticketId
            ${whereString}
            GROUP BY t.id
            ORDER BY t.createdAt DESC
            LIMIT ? OFFSET ?
        `;

        const rows = db.prepare(query).all(...params, limit + 1, offset) as DbTicketRow[];
        
        const hasMore = rows.length > limit;
        const data = (hasMore ? rows.slice(0, limit) : rows).map(r => ({ 
            ...r, 
            isBillable: r.isBillable === 1,
            hasActiveTimer: r.hasActiveTimer === 1,
            totalDuration: r.totalDuration || 0
        }));

        return JSON.parse(JSON.stringify({ data, hasMore }));
    } catch (error: unknown) {
        logError("Failed to fetch paginated tickets", { error: (error as Error).message, filters, page });
        return { data: [], hasMore: false };
    }
}

export async function getTicketById(id: number): Promise<Ticket | null> {
    const db = await connectTicketsDb();
    const result = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as DbTicketRow | undefined;
    if (!result) return null;
    return JSON.parse(JSON.stringify({ ...result, isBillable: result.isBillable === 1 }));
}

export async function getTicketThread(ticketId: number): Promise<TicketThread[]> {
    const db = await connectTicketsDb();
    const rows = db.prepare('SELECT * FROM ticket_threads WHERE ticketId = ? ORDER BY createdAt ASC').all(ticketId) as TicketThread[];
    return JSON.parse(JSON.stringify(rows));
}

export async function addThreadEntry(payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' | 'status_change' }): Promise<TicketThread> {
    await authorizeAction('tickets:reply');
    const db = await connectTicketsDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(payload.ticketId, payload.userId, payload.userName, payload.type, payload.content, now);
    db.prepare('UPDATE tickets SET updatedAt = ? WHERE id = ?').run(now, payload.ticketId);
    const row = db.prepare('SELECT * FROM ticket_threads WHERE id = ?').get(info.lastInsertRowid) as TicketThread;

    if (payload.type === 'message') {
        try {
            const ticket = db.prepare('SELECT consecutive, customerEmail, companyName, customerName FROM tickets WHERE id = ?').get(payload.ticketId) as { consecutive: string, customerEmail: string, companyName: string, customerName: string } | undefined;
            if (ticket) {
                await triggerNotificationEvent('onTicketReplyAdded', {
                    ...row,
                    consecutive: ticket.consecutive,
                    customerEmail: ticket.customerEmail,
                    companyName: ticket.companyName,
                    customerName: ticket.customerName
                });
            }
        } catch (e) { console.error(e); }
    }

    return JSON.parse(JSON.stringify(row));
}

export async function updateTicketDetails(ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId' | 'isBillable' | 'providerId' | 'licenseId' | 'equipmentId'>>, user: User): Promise<Ticket> {
    await authorizeAction('tickets:manage');
    const db = await connectTicketsDb();
    const currentTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as DbTicketRow;
    if (!currentTicket) throw new Error("Ticket not found.");
    
    const transaction = db.transaction(() => {
        const now = new Date().toISOString();
        let query = 'UPDATE tickets SET updatedAt = ?';
        const params: (string | number | null)[] = [now];
        const notes: string[] = [];

        if (updates.status && updates.status !== currentTicket.status) {
            query += ', status = ?';
            params.push(updates.status);
            notes.push(`Estado: ${statusLabels[updates.status] || updates.status}`);

            if (updates.status === 'in_progress') {
                const running = db.prepare('SELECT id FROM time_entries WHERE ticketId = ? AND endTime IS NULL').get(ticketId);
                if (!running) {
                    db.prepare(`
                        INSERT INTO time_entries (ticketId, userId, startTime, isBillable, billingStatus, createdAt)
                        VALUES (?, ?, ?, ?, 'pending', ?)
                    `).run(ticketId, user.id, now, currentTicket.isBillable === 1 ? 1 : 0, now);
                }
            }

            if (['on_hold', 'completed', 'canceled'].includes(updates.status)) {
                const active = db.prepare('SELECT id, startTime FROM time_entries WHERE ticketId = ? AND endTime IS NULL').get(ticketId) as { id: number; startTime: string } | undefined;
                if (active) {
                    const start = new Date(active.startTime).getTime();
                    const end = new Date(now).getTime();
                    const duration = end - start;
                    db.prepare('UPDATE time_entries SET endTime = ?, duration = ?, billableDuration = ? WHERE id = ?')
                      .run(now, duration, duration, active.id);
                }
            }
        }

        if (updates.priority && updates.priority !== currentTicket.priority) { 
            query += ', priority = ?'; 
            params.push(updates.priority); 
            notes.push(`Prioridad: ${priorityLabels[updates.priority] || updates.priority}`); 
        }
        
        if (updates.assigneeId !== undefined && updates.assigneeId !== currentTicket.assigneeId) { 
            query += ', assigneeId = ?'; 
            params.push(updates.assigneeId); 
            notes.push(`Asignado`); 
        }
        
        if (updates.isBillable !== undefined && !!updates.isBillable !== (currentTicket.isBillable === 1)) { 
            query += ', isBillable = ?'; 
            params.push(updates.isBillable ? 1 : 0); 
            notes.push(`Facturación: ${updates.isBillable ? 'Facturable' : 'No facturable'}`); 
        }
        
        if (updates.providerId !== undefined && updates.providerId !== currentTicket.providerId) { 
            query += ', providerId = ?'; 
            params.push(updates.providerId); 
            notes.push(`Proveedor externo actualizado`); 
        }

        if (updates.licenseId !== undefined && updates.licenseId !== currentTicket.licenseId) { 
            query += ', licenseId = ?'; 
            params.push(updates.licenseId); 
            notes.push(`Licencia vinculada actualizada`); 
        }

        if (updates.equipmentId !== undefined && updates.equipmentId !== currentTicket.equipmentId) { 
            query += ', equipmentId = ?'; 
            params.push(updates.equipmentId); 
            notes.push(`Equipo de inventario vinculado`); 
        }
        
        query += ' WHERE id = ?';
        params.push(ticketId);

        if (params.length > 2) {
            db.prepare(query).run(...params);
            db.prepare(`INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)`)
              .run(ticketId, user.id, user.name, 'status_change', notes.join('. '), now);
        }
        return db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as DbTicketRow;
    });

    const result = transaction() as DbTicketRow;

    try {
        const settings = await getCompanySettings();
        const service = settings.servicesCatalog.find(s => s.id === result.serviceId);
        
        let assigneeName = 'Sin asignar';
        const assigneeId = result.assigneeId;
        if (assigneeId) {
            const assignee = db.prepare('SELECT name FROM users WHERE id = ?').get(assigneeId) as { name: string } | undefined;
            if (assignee) assigneeName = assignee.name;
        }

        const translatedTicket = {
            ...result,
            serviceName: service?.name || 'No especificado',
            assigneeName: assigneeName,
            status: statusLabels[result.status] || result.status,
            priority: priorityLabels[result.priority] || result.priority,
            isBillable: result.isBillable === 1
        };

        if (updates.status && (updates.status === 'completed' || updates.status === 'canceled')) {
            const event = updates.status === 'completed' ? 'onTicketCompleted' : 'onTicketCanceled';
            const thread = db.prepare('SELECT content FROM ticket_threads WHERE ticketId = ? AND type = "message" ORDER BY createdAt DESC LIMIT 1').get(ticketId) as { content: string } | undefined;
            
            await triggerNotificationEvent(event, {
                ...translatedTicket,
                content: thread?.content || 'El caso fue actualizado satisfactoriamente.',
                userName: user.name
            });
        } else if (updates.status) {
            await triggerNotificationEvent('onTicketStatusChanged', translatedTicket);
        }

        if (updates.priority === 'urgent') {
            await triggerNotificationEvent('onTicketPriorityUrgent', translatedTicket);
        }
    } catch (e) { console.error(e); }

    return JSON.parse(JSON.stringify({ ...result, isBillable: result.isBillable === 1 }));
}

export async function getHelpTopics(): Promise<HelpTopic[]> {
    const db = await connectTicketsDb();
    const rows = db.prepare('SELECT * FROM help_topics ORDER BY name ASC').all() as HelpTopic[];
    return JSON.parse(JSON.stringify(rows));
}

export async function addHelpTopic(topic: Omit<HelpTopic, 'id'>): Promise<HelpTopic> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    const info = db.prepare('INSERT INTO help_topics (name, defaultPriority, defaultAssigneeId, defaultServiceId) VALUES (?, ?, ?, ?)').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.defaultServiceId);
    const row = db.prepare('SELECT * FROM help_topics WHERE id = ?').get(info.lastInsertRowid) as HelpTopic;
    return JSON.parse(JSON.stringify(row));
}

export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('UPDATE help_topics SET name = ?, defaultPriority = ?, defaultAssigneeId = ?, defaultServiceId = ? WHERE id = ?').run(topic.name, topic.defaultPriority, topic.defaultAssigneeId, topic.defaultServiceId, topic.id);
    const row = db.prepare('SELECT * FROM help_topics WHERE id = ?').get(topic.id) as HelpTopic;
    return JSON.parse(JSON.stringify(row));
}

export async function deleteHelpTopic(id: number): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM help_topics WHERE id = ?').run(id);
}

export async function deleteTicket(id: number): Promise<void> {
    await authorizeAction('tickets:delete');
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
    if (!customer) return JSON.parse(JSON.stringify({ customer: null, supportPackage: null, services: [] }));
    const settings = await getCompanySettings();
    const pkgId = customer.supportPackageId as string | undefined;
    const pkg = settings.supportPackages.find((p: SupportPackage) => p.id === pkgId) || null;
    return JSON.parse(JSON.stringify({ customer, supportPackage: pkg, services: settings.servicesCatalog }));
}

export async function getThirdPartyProviders(): Promise<ThirdPartyProvider[]> {
    const db = await connectTicketsDb();
    const providers = db.prepare('SELECT * FROM third_party_providers ORDER BY name ASC').all() as (ThirdPartyProvider & { contacts: string })[];
    
    const results = providers.map(p => ({
        ...p,
        contacts: JSON.parse(p.contacts || '[]'),
        services: db.prepare('SELECT * FROM provider_services WHERE providerId = ?').all(p.id) as ProviderService[],
        geoRates: db.prepare('SELECT * FROM provider_geo_rates WHERE providerId = ?').all(p.id) as ProviderGeoRate[]
    }));

    return JSON.parse(JSON.stringify(results));
}

export async function addThirdPartyProvider(payload: Omit<ThirdPartyProvider, 'id' | 'createdAt'>): Promise<ThirdPartyProvider> {
    await authorizeAction('providers:manage');
    const db = await connectTicketsDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO third_party_providers (name, email, phone, specialty, notes, contacts, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(payload.name, payload.email, payload.phone, payload.specialty, payload.notes, JSON.stringify(payload.contacts || []), now);
    const row = { ...payload, id: Number(info.lastInsertRowid), createdAt: now, services: [], geoRates: [] } as ThirdPartyProvider;
    return JSON.parse(JSON.stringify(row));
}

export async function updateThirdPartyProvider(payload: ThirdPartyProvider): Promise<ThirdPartyProvider> {
    await authorizeAction('providers:manage');
    const db = await connectTicketsDb();
    db.prepare(`UPDATE third_party_providers SET name = @name, email = @email, phone = @phone, specialty = @specialty, notes = @notes, contacts = @contacts WHERE id = @id`)
        .run(payload.name, payload.email, payload.phone, payload.specialty, payload.notes, JSON.stringify(payload.contacts || []), payload.id);
    return JSON.parse(JSON.stringify(payload));
}

export async function deleteThirdPartyProvider(id: number): Promise<void> {
    await authorizeAction('providers:manage');
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM third_party_providers WHERE id = ?').run(id);
}

export async function saveProviderService(payload: Omit<ProviderService, 'id'>): Promise<ProviderService> {
    await authorizeAction('providers:manage');
    const db = await connectTicketsDb();
    const info = db.prepare(`
        INSERT INTO provider_services (
            providerId, serviceId, 
            buyPriceRemote, marginRemote, taxRate, sellPriceRemote,
            buyPriceOnSite, marginOnSite, sellPriceOnSite
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        payload.providerId, payload.serviceId, 
        payload.buyPriceRemote, payload.marginRemote, payload.taxRate || 13, payload.sellPriceRemote,
        payload.buyPriceOnSite, payload.marginOnSite, payload.sellPriceOnSite
    );
    const row = { ...payload, id: Number(info.lastInsertRowid) } as ProviderService;
    return JSON.parse(JSON.stringify(row));
}

export async function deleteProviderService(id: number): Promise<void> {
    await authorizeAction('providers:manage');
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM provider_services WHERE id = ?').run(id);
}

export async function saveProviderGeoRate(payload: Omit<ProviderGeoRate, 'id'>): Promise<ProviderGeoRate> {
    await authorizeAction('providers:manage');
    const db = await connectTicketsDb();
    const info = db.prepare(`
        INSERT INTO provider_geo_rates (
            providerId, provinceId, cantonId, districtId, 
            buyTravelPrice, marginTravel, taxRate, sellTravelPrice, locationName
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        payload.providerId, payload.provinceId, payload.cantonId || null, payload.districtId || null, 
        payload.buyTravelPrice, payload.marginTravel, payload.taxRate || 13, payload.sellTravelPrice, payload.locationName
    );
    const row = { ...payload, id: Number(info.lastInsertRowid) } as ProviderGeoRate;
    return JSON.parse(JSON.stringify(row));
}

export async function deleteProviderGeoRate(id: number): Promise<void> {
    await authorizeAction('providers:manage');
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM provider_geo_rates WHERE id = ?').run(id);
}

export async function getCRGeoData(): Promise<{ provinces: Province[], cantons: Canton[], districts: District[] }> {
    const db = await connectTicketsDb();
    const data = {
        provinces: db.prepare('SELECT * FROM provinces ORDER BY name ASC').all() as Province[],
        cantons: db.prepare('SELECT * FROM cantons ORDER BY name ASC').all() as Canton[],
        districts: db.prepare('SELECT * FROM districts ORDER BY name ASC').all() as District[]
    };
    return JSON.parse(JSON.stringify(data));
}

export async function addProvince(name: string): Promise<Province> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    const info = db.prepare('INSERT INTO provinces (name) VALUES (?)').run(name);
    return JSON.parse(JSON.stringify({ id: Number(info.lastInsertRowid), name }));
}

export async function updateProvince(id: number, name: string): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('UPDATE provinces SET name = ? WHERE id = ?').run(name, id);
}

export async function deleteProvince(id: number): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM provinces WHERE id = ?').run(id);
}

export async function addCanton(provinceId: number, name: string): Promise<Canton> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    const info = db.prepare('INSERT INTO cantons (provinceId, name) VALUES (?, ?)').run(provinceId, name);
    return JSON.parse(JSON.stringify({ id: Number(info.lastInsertRowid), provinceId, name }));
}

export async function updateCanton(id: number, name: string): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('UPDATE cantons SET name = ? WHERE id = ?').run(name, id);
}

export async function deleteCanton(id: number): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM cantons WHERE id = ?').run(id);
}

export async function addDistrict(cantonId: number, name: string): Promise<District> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    const info = db.prepare('INSERT INTO districts (cantonId, name) VALUES (?, ?)').run(cantonId, name);
    return JSON.parse(JSON.stringify({ id: Number(info.lastInsertRowid), cantonId, name }));
}

export async function updateDistrict(id: number, name: string): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('UPDATE districts SET name = ? WHERE id = ?').run(name, id);
}

export async function deleteDistrict(id: number): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare('DELETE FROM districts WHERE id = ?').run(id);
}

export async function getTicketSettings(): Promise<{ ticketPrefix: string; nextTicketNumber: number }> {
    const db = await connectTicketsDb();
    const prefix = db.prepare("SELECT value FROM ticket_settings WHERE key = 'ticketPrefix'").get() as { value: string } | undefined;
    const next = db.prepare("SELECT value FROM ticket_settings WHERE key = 'nextTicketNumber'").get() as { value: string } | undefined;
    return JSON.parse(JSON.stringify({
        ticketPrefix: prefix?.value || 'CAS-',
        nextTicketNumber: next ? parseInt(next.value, 10) : 1
    }));
}

export async function saveTicketSettings(settings: { ticketPrefix: string; nextTicketNumber: number }): Promise<void> {
    await authorizeAction('tickets:admin:settings');
    const db = await connectTicketsDb();
    db.prepare("INSERT OR REPLACE INTO ticket_settings (key, value) VALUES ('ticketPrefix', ?)").run(settings.ticketPrefix);
    db.prepare("INSERT OR REPLACE INTO ticket_settings (key, value) VALUES ('nextTicketNumber', ?)").run(String(settings.nextTicketNumber));
}

export async function getLicensesByCustomer(customerId: string): Promise<License[]> {
    const db = await connectTicketsDb();
    const rows = db.prepare("SELECT * FROM licenses WHERE customerId = ? AND status = 'active'").all(customerId) as License[];
    return JSON.parse(JSON.stringify(rows));
}

