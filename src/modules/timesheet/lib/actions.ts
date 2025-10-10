/**
 * @fileoverview Client-side functions for the Timesheet module.
 */
'use client';

import { logInfo, logError } from '@/modules/core/lib/logger';
import type { TimeEntry } from '@/modules/core/types';
import { 
    addTimeEntry as addTimeEntryServer, 
    getEntriesForTicket as getEntriesForTicketServer,
    stopTimeEntry as stopTimeEntryServer,
    deleteTimeEntry as deleteTimeEntryServer
} from './db';

type NewTimeEntryPayload = Omit<TimeEntry, 'id' | 'createdAt'>;

export const addTimeEntry = async (payload: Partial<NewTimeEntryPayload>): Promise<TimeEntry> => {
    try {
        const entry = await addTimeEntryServer(payload);
        await logInfo(`Time entry created for ticket #${payload.ticketId}`, { entryId: entry.id });
        return JSON.parse(JSON.stringify(entry));
    } catch (error) {
        logError("Error creating time entry from client action", { error: (error as Error).message });
        throw error;
    }
};

export const getEntriesForTicket = async (ticketId: number): Promise<TimeEntry[]> => {
    const entries = await getEntriesForTicketServer(ticketId);
    return JSON.parse(JSON.stringify(entries));
};

export const stopTimeEntry = async (entryId: number, notes: string, isBillable: boolean): Promise<TimeEntry> => {
    try {
        const updatedEntry = await stopTimeEntryServer(entryId, notes, isBillable);
        await logInfo(`Timer stopped for entry #${entryId}`, { duration: updatedEntry.duration });
        return JSON.parse(JSON.stringify(updatedEntry));
    } catch (error) {
        logError("Error stopping timer from client action", { error: (error as Error).message });
        throw error;
    }
};

export const deleteTimeEntry = async (entryId: number): Promise<void> => {
     try {
        await deleteTimeEntryServer(entryId);
        await logInfo(`Time entry #${entryId} deleted.`);
    } catch (error) {
        logError("Error deleting time entry from client action", { error: (error as Error).message });
        throw error;
    }
}
