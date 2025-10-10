
/**
 * @fileoverview Server-side functions for the timesheet database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { TimeEntry } from '@/modules/core/types';

const TIMESHEET_DB_FILE = 'timesheet.db';

export async function initializeTimesheetDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            startTime TEXT NOT NULL,
            endTime TEXT,
            duration INTEGER, -- in milliseconds
            notes TEXT,
            isBillable BOOLEAN NOT NULL DEFAULT TRUE,
            createdAt TEXT NOT NULL
        );
    `;
    db.exec(schema);
    
    console.log(`Database ${TIMESHEET_DB_FILE} initialized for Time Tracking.`);
}

export async function runTimesheetMigrations(db: import('better-sqlite3').Database) {
    // Future migrations for the timesheet module can be added here.
}

export async function addTimeEntry(payload: Partial<Omit<TimeEntry, 'id'|'createdAt'>>): Promise<TimeEntry> {
    const db = await connectDb(TIMESHEET_DB_FILE);
    const now = new Date().toISOString();
    
    const { ticketId, userId, startTime, endTime, duration, notes, isBillable } = payload;
    
    const info = db.prepare(`
        INSERT INTO time_entries (ticketId, userId, startTime, endTime, duration, notes, isBillable, createdAt)
        VALUES (@ticketId, @userId, @startTime, @endTime, @duration, @notes, @isBillable, @createdAt)
    `).run({
        ticketId,
        userId,
        startTime,
        endTime: endTime || null,
        duration: duration || null,
        notes: notes || null,
        isBillable: isBillable === false ? 0 : 1,
        createdAt: now
    });

    const newEntry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(info.lastInsertRowid) as TimeEntry;
    return JSON.parse(JSON.stringify(newEntry));
}

export async function getEntriesForTicket(ticketId: number): Promise<TimeEntry[]> {
    const db = await connectDb(TIMESHEET_DB_FILE);
    const results = db.prepare('SELECT * FROM time_entries WHERE ticketId = ? ORDER BY createdAt DESC').all(ticketId) as TimeEntry[];
    return JSON.parse(JSON.stringify(results));
}

export async function stopTimeEntry(entryId: number, notes: string, isBillable: boolean): Promise<TimeEntry> {
    const db = await connectDb(TIMESHEET_DB_FILE);
    const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry | undefined;
    if (!entry || entry.endTime) {
        throw new Error('La entrada de tiempo no existe o ya ha sido detenida.');
    }

    const endTime = new Date();
    const startTime = new Date(entry.startTime);
    const duration = endTime.getTime() - startTime.getTime();
    
    db.prepare(`
        UPDATE time_entries
        SET endTime = ?, duration = ?, notes = ?, isBillable = ?
        WHERE id = ?
    `).run(endTime.toISOString(), duration, notes, isBillable ? 1 : 0, entryId);
    
    const updatedEntry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry;
    return JSON.parse(JSON.stringify(updatedEntry));
}

export async function deleteTimeEntry(entryId: number): Promise<void> {
    const db = await connectDb(TIMESHEET_DB_FILE);
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(entryId);
}


    