/**
 * @fileoverview Server-side functions for the timesheet module.
 * Unified into intratool.db.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import { getCompanySettings } from '../../core/lib/settings-db';
import type { TimeEntry, SupportPackage, Customer } from '@/modules/core/types';

export async function addTimeEntry(payload: Partial<Omit<TimeEntry, 'id'|'createdAt'>>): Promise<TimeEntry> {
    const db = await connectDb();
    const now = new Date().toISOString();
    const { ticketId, userId, startTime, endTime, duration, notes, isBillable } = payload;
    
    const info = db.prepare(`
        INSERT INTO time_entries (ticketId, userId, startTime, endTime, duration, billableDuration, notes, isBillable, billingStatus, createdAt)
        VALUES (@ticketId, @userId, @startTime, @endTime, @duration, @billableDuration, @notes, @isBillable, 'pending', @createdAt)
    `).run({
        ticketId, userId, startTime,
        endTime: endTime || null,
        duration: duration || null,
        billableDuration: duration || null, // Default to actual duration if provided
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

/**
 * Calculates the rounded billable duration based on the client's support package.
 */
function calculateBillableDuration(actualMs: number, pkg: SupportPackage | null): number {
    if (!pkg) return actualMs;

    const actualMin = actualMs / 60000;
    
    // Check grace period
    if (pkg.graceMinutes > 0 && actualMin <= pkg.graceMinutes) {
        return 0;
    }

    // Apply rounding multiple
    const multiple = pkg.roundingMultiple || 1;
    const roundedMin = Math.ceil(actualMin / multiple) * multiple;
    
    return roundedMin * 60000;
}

export async function stopTimeEntry(entryId: number, notes: string, isBillable: boolean): Promise<TimeEntry> {
    const db = await connectDb();
    const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry | undefined;
    if (!entry || entry.endTime) throw new Error('Entrada no válida o ya detenida.');

    const endTime = new Date();
    const startTime = new Date(entry.startTime);
    const actualDuration = endTime.getTime() - startTime.getTime();
    
    // Fetch rounding and grace rules from the customer's package
    let billableDuration = actualDuration;
    try {
        const ticketRow = db.prepare(`
            SELECT t.id, c.supportPackageId 
            FROM tickets t
            JOIN customers c ON t.customerName = c.name
            WHERE t.id = ?
        `).get(entry.ticketId) as { supportPackageId: string } | undefined;

        if (ticketRow?.supportPackageId) {
            const companySettings = await getCompanySettings();
            const pkg = companySettings.supportPackages.find(p => p.id === ticketRow.supportPackageId) || null;
            billableDuration = calculateBillableDuration(actualDuration, pkg);
        }
    } catch (e) {
        console.error("Failed to calculate billable duration, falling back to actual:", e);
    }

    db.prepare(`UPDATE time_entries SET endTime = ?, duration = ?, billableDuration = ?, notes = ?, isBillable = ? WHERE id = ?`)
      .run(endTime.toISOString(), actualDuration, billableDuration, notes, isBillable ? 1 : 0, entryId);
    
    return db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry;
}

export async function deleteTimeEntry(entryId: number): Promise<void> {
    const db = await connectDb();
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(entryId);
}
