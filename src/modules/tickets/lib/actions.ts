
/**
 * @fileoverview Client-side functions for interacting with the ticket module's server-side DB functions.
 */
'use client';

import { logInfo, logError } from '@/modules/core/lib/logger';
import type { Ticket, NewTicketPayload, User } from '@/modules/core/types';
import { addTicket } from './db';

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
