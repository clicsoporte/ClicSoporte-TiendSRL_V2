/**
 * @fileoverview Client-side functions for interacting with the ticket module's server-side DB functions.
 */
'use client';

import { logInfo, logError } from '@/modules/core/lib/logger';
import type { Ticket, NewTicketPayload, User, TicketThread, HelpTopic, ClientCompany, Customer, Service, SupportPackage } from '@/modules/core/types';
import { 
    addTicket as addTicketServer, 
    getTickets as getTicketsServer, 
    getTicketById as getTicketByIdServer, 
    getTicketThread as getTicketThreadServer, 
    addThreadEntry as addThreadEntryServer, 
    updateTicketDetails as updateTicketDetailsServer, 
    getHelpTopics as getHelpTopicsServer,
    addHelpTopic as addHelpTopicServer,
    updateHelpTopic as updateHelpTopicServer,
    deleteHelpTopic as deleteHelpTopicServer,
    addClientCompany as addClientCompanyServer,
    getClientCompanies as getClientCompaniesServer,
    deleteTicket as deleteTicketServer
} from './db';

/**
 * Saves a new ticket to the database.
 * @param payload - The data for the new ticket.
 * @param user - The user creating the ticket.
 * @returns The newly created ticket object.
 */
export async function saveTicket(payload: NewTicketPayload, user: User): Promise<Ticket> {
    try {
        const createdTicket = await addTicketServer(payload, user);
        await logInfo(`New ticket #${createdTicket.consecutive} created by ${user.name}`, { 
            ticketId: createdTicket.id, 
            subject: payload.subject,
            customer: payload.customerName 
        });
        return createdTicket;
    } catch (error) {
        logError("Error saving ticket from client action", { error: (error as Error).message });
        throw error;
    }
}

export async function addClientCompany(payload: Omit<ClientCompany, 'id' | 'createdAt'>): Promise<ClientCompany> {
    try {
        const newCompany = await addClientCompanyServer(payload);
        await logInfo(`New client company created: ${payload.name}`);
        return newCompany;
    } catch (error) {
        logError("Error saving client company from client action", { error: (error as Error).message });
        throw error;
    }
}

export async function getClientCompanies(): Promise<ClientCompany[]> {
    return getClientCompaniesServer();
}

/**
 * Fetches all tickets from the server.
 * @returns A promise that resolves to an array of all tickets.
 */
export async function getTickets(): Promise<Ticket[]> {
    return getTicketsServer();
}

/**
 * Fetches a single ticket by its ID.
 * @param id - The ID of the ticket to fetch.
 * @returns A promise that resolves to the ticket object or null if not found.
 */
export async function getTicketById(id: number): Promise<Ticket | null> {
    return getTicketByIdServer(id);
}

/**
 * Fetches the conversation thread for a specific ticket.
 * @param ticketId - The ID of the ticket.
 * @returns A promise that resolves to an array of thread entries.
 */
export async function getTicketThread(ticketId: number): Promise<TicketThread[]> {
    return getTicketThreadServer(ticketId);
}

/**
 * Adds a new entry to a ticket's conversation thread.
 * @param payload - The data for the new thread entry.
 * @returns The newly created thread entry.
 */
export async function addThreadEntry(payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' }): Promise<TicketThread> {
    const newEntry = await addThreadEntryServer(payload);
    await logInfo(`Reply added to ticket #${payload.ticketId} by ${payload.userName}`);
    return newEntry;
}

/**
 * Updates details of a ticket, such as status, priority, or assignee.
 * @param ticketId - The ID of the ticket to update.
 * @param updates - An object containing the fields to update.
 * @param user - The user performing the update.
 * @returns The updated ticket object.
 */
export async function updateTicketDetails(ticketId: number, updates: Partial<Pick<Ticket, 'status' | 'priority' | 'assigneeId'>>, user: User): Promise<Ticket> {
    const updatedTicket = await updateTicketDetailsServer(ticketId, updates, user);
    await logInfo(`Ticket #${ticketId} details updated by ${user.name}`, { updates });
    return updatedTicket;
}

/**
 * Fetches all available help topics.
 * @returns A promise that resolves to an array of help topics.
 */
export async function getHelpTopics(): Promise<HelpTopic[]> {
    return getHelpTopicsServer();
}

/**
 * Adds a new help topic.
 * @param topic - The help topic data.
 * @returns The newly created help topic.
 */
export async function addHelpTopic(topic: Omit<HelpTopic, 'id'>): Promise<HelpTopic> {
    return addHelpTopicServer(topic);
}

/**
 * Updates an existing help topic.
 * @param topic - The help topic data to update.
 * @returns The updated help topic.
 */
export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    return updateHelpTopicServer(topic);
}

/**
 * Deletes a help topic.
 * @param id - The ID of the help topic to delete.
 */
export async function deleteHelpTopic(id: number): Promise<void> {
    return deleteHelpTopicServer(id);
}

export async function deleteTicket(id: number): Promise<void> {
    await logInfo(`Ticket with ID ${id} deleted.`);
    return deleteTicketServer(id);
}

export async function getCustomerSupportInfo(customerId: string): Promise<{ customer: Customer | null, supportPackage: SupportPackage | null, services: Service[] }> {
    const mainDb = await connectDb();
    const customer = mainDb.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as Customer | null;
    
    if (!customer || !customer.supportPackageId) {
        return { customer, supportPackage: null, services: [] };
    }

    const companySettingsRow = mainDb.prepare('SELECT supportPackages, servicesCatalog FROM company_settings WHERE id = 1').get() as { supportPackages: string, servicesCatalog: string } | undefined;
    if (!companySettingsRow) {
        return { customer, supportPackage: null, services: [] };
    }

    const allPackages = JSON.parse(companySettingsRow.supportPackages || '[]') as SupportPackage[];
    const allServices = JSON.parse(companySettingsRow.servicesCatalog || '[]') as Service[];
    const supportPackage = allPackages.find(p => p.id === customer.supportPackageId) || null;
    
    return { customer, supportPackage, services: allServices };
}
