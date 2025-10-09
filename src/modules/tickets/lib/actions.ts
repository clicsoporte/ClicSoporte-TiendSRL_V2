
/**
 * @fileoverview Client-side functions for interacting with the ticket module's server-side DB functions.
 */
'use client';

import { logInfo, logError } from '@/modules/core/lib/logger';
import type { Ticket, NewTicketPayload, User, TicketThread } from '@/modules/core/types';
import { addTicket, getTickets as getTicketsServer, getTicketById as getTicketByIdServer, getTicketThread as getTicketThreadServer } from './db';

/**
 * Saves a new ticket to the database.
 * @param payload - The data for the new ticket.
 * @param user - The user creating the ticket.
 * @returns The newly created ticket object.
 */
export async function saveTicket(payload: NewTicketPayload, user: User): Promise<Ticket> {
    try {
        const createdTicket = await addTicket(payload, user);
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
