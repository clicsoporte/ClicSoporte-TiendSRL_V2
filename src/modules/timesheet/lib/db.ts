/**
 * @fileoverview Server-side functions for the timesheet module.
 * Unified into intratool.db.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { TimeEntry } from '@/modules/core/types';

export async function addTimeEntry(payload: Partial<Omit<TimeEntry, 'id'|'createdAt'>>): Promise<TimeEntry> {
    const db = await connectDb();
    const now = new Date().toISOString();
    const { ticketId, userId, startTime, endTime, duration, notes, isBillable } = payload;
    
    const info = db.prepare(`
        INSERT INTO time_entries (ticketId, userId, startTime, endTime, duration, notes, isBillable, createdAt)
        VALUES (@ticketId, @userId, @startTime, @endTime, @duration, @notes, @isBillable, @createdAt)
    `).run({
        ticketId, userId, startTime,
        endTime: endTime || null,
        duration: duration || null,
        notes: notes || null,
        isBillable: isBillable === false ? 0 : 1,
        createdAt: now
    });

    return db.prepare('SELECT * FROM time_entries WHERE id = ?').get(info.lastInsertRowid) as TimeEntry;
}

export async function getEntriesForTicket(ticketId: number): Promise<TimeEntry[]> {
    const db = await connectDb();
    return db.prepare('SELECT * FROM time_entries WHERE ticketId = ? ORDER BY createdAt DESC').all(ticketId) as TimeEntry[];
}

export async function stopTimeEntry(entryId: number, notes: string, isBillable: boolean): Promise<TimeEntry> {
    const db = await connectDb();
    const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry | undefined;
    if (!entry || entry.endTime) throw new Error('Entrada no válida o ya detenida.');

    const endTime = new Date();
    const startTime = new Date(entry.startTime);
    const duration = endTime.getTime() - startTime.getTime();
    
    db.prepare(`UPDATE time_entries SET endTime = ?, duration = ?, notes = ?, isBillable = ? WHERE id = ?`)
      .run(endTime.toISOString(), duration, notes, isBillable ? 1 : 0, entryId);
    
    return db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry;
}

export async function deleteTimeEntry(entryId: number): Promise<void> {
    const db = await connectDb();
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(entryId);
}
