
/**
 * @fileoverview Server-side database functions specifically for the logger.
 * This file is separated to prevent circular dependencies between the main db.ts and logger.ts.
 */
"use server";

import { connectDb } from './db';
import type { LogEntry } from "@/modules/core/types";

/**
 * Inserts a new log entry into the database.
 * @param log - The log entry object to add.
 */
export async function addLog(log: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> {
    const db = await connectDb();
    const { type, message, details } = log;
    
    try {
        const stmt = db.prepare('INSERT INTO logs (timestamp, type, message, details) VALUES (?, ?, ?, ?)');
        stmt.run(new Date().toISOString(), type, message, details ? JSON.stringify(details) : null);
    } catch (error) {
        console.error('Failed to write to log database:', error);
    }
}
