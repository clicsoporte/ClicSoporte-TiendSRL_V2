/**
 * @fileoverview Client-side functions for interacting with the ticket module's server-side DB functions.
 */
'use client';

import { logInfo, logError } from '@/modules/core/lib/logger';
import type { Ticket, NewTicketPayload, User, TicketThread, HelpTopic, ClientCompany, Customer, SupportPackage, Service } from '@/modules/core/types';
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
    updateClientCompany as updateClientCompanyServer,
    deleteClientCompany as deleteClientCompanyServer,
    getClientCompanies as getClientCompaniesServer,
    deleteTicket as deleteTicketServer,
    getCustomerSupportInfo as getCustomerSupportInfoServer,
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
        return JSON.parse(JSON.stringify(createdTicket));
    } catch (error) {
        logError("Error saving ticket from client action", { error: (error as Error).message });
        throw error;
    }
}

export async function addClientCompany(payload: Omit<ClientCompany, 'id' | 'createdAt'>): Promise<ClientCompany> {
    try {
        const newCompany = await addClientCompanyServer(payload);
        await logInfo(`New client company created: ${payload.name}`);
        return JSON.parse(JSON.stringify(newCompany));
    } catch (error) {
        logError("Error saving client company from client action", { error: (error as Error).message });
        throw error;
    }
}

export async function updateClientCompany(payload: ClientCompany): Promise<ClientCompany> {
    try {
        const updatedCompany = await updateClientCompanyServer(payload);
        await logInfo(`Client company updated: ${payload.name}`);
        return JSON.parse(JSON.stringify(updatedCompany));
    } catch (error) {
        logError("Error updating client company from client action", { error: (error as Error).message });
        throw error;
    }
}

export async function deleteClientCompany(id: number): Promise<void> {
     try {
        await deleteClientCompanyServer(id);
        await logInfo(`Client company with ID ${id} deleted.`);
    } catch (error) {
        logError("Error deleting client company from client action", { error: (error as Error).message });
        throw error;
    }
}


export async function getClientCompanies(): Promise<ClientCompany[]> {
    const companies = await getClientCompaniesServer();
    return JSON.parse(JSON.stringify(companies));
}

/**
 * Fetches all tickets from the server.
 * @returns A promise that resolves to an array of all tickets.
 */
export async function getTickets(): Promise<Ticket[]> {
    const tickets = await getTicketsServer();
    return JSON.parse(JSON.stringify(tickets));
}

/**
 * Fetches a single ticket by its ID.
 * @param id - The ID of the ticket to fetch.
 * @returns A promise that resolves to the ticket object or null if not found.
 */
export async function getTicketById(id: number): Promise<Ticket | null> {
    const ticket = await getTicketByIdServer(id);
    return ticket ? JSON.parse(JSON.stringify(ticket)) : null;
}

/**
 * Fetches the conversation thread for a specific ticket.
 * @param ticketId - The ID of the ticket.
 * @returns A promise that resolves to an array of thread entries.
 */
export async function getTicketThread(ticketId: number): Promise<TicketThread[]> {
    const thread = await getTicketThreadServer(ticketId);
    return JSON.parse(JSON.stringify(thread));
}

/**
 * Adds a new entry to a ticket's conversation thread.
 * @param payload - The data for the new thread entry.
 * @returns The newly created thread entry.
 */
export async function addThreadEntry(payload: { ticketId: number; userId: number; userName: string; content: string; type: 'message' | 'note' }): Promise<TicketThread> {
    const newEntry = await addThreadEntryServer(payload);
    await logInfo(`Reply added to ticket #${payload.ticketId} by ${payload.userName}`);
    return JSON.parse(JSON.stringify(newEntry));
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
    return JSON.parse(JSON.stringify(updatedTicket));
}

/**
 * Fetches all available help topics.
 * @returns A promise that resolves to an array of help topics.
 */
export async function getHelpTopics(): Promise<HelpTopic[]> {
    const topics = await getHelpTopicsServer();
    return JSON.parse(JSON.stringify(topics));
}

/**
 * Adds a new help topic.
 * @param topic - The help topic data.
 * @returns The newly created help topic.
 */
export async function addHelpTopic(topic: Omit<HelpTopic, 'id'>): Promise<HelpTopic> {
    const newTopic = await addHelpTopicServer(topic);
    return JSON.parse(JSON.stringify(newTopic));
}

/**
 * Updates an existing help topic.
 * @param topic - The help topic data to update.
 * @returns The updated help topic.
 */
export async function updateHelpTopic(topic: HelpTopic): Promise<HelpTopic> {
    const updatedTopic = await updateHelpTopicServer(topic);
    return JSON.parse(JSON.stringify(updatedTopic));
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

export async function getCustomerSupportInfo(companyId: number | string): Promise<{ customer: Customer | ClientCompany | null; supportPackage: SupportPackage | null, services: Service[] }> {
    const info = await getCustomerSupportInfoServer(companyId);
    return JSON.parse(JSON.stringify(info));
}
