/**
 * @fileoverview Server-side functions for the timesheet module.
 * Unified into intratool.db. Handles rounding and grace period logic.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import { getCompanySettings } from '../../core/lib/settings-db';
import type { TimeEntry, SupportPackage } from '@/modules/core/types';
import type { Database } from 'better-sqlite3';

/**
 * Calculates the rounded billable duration based on the client's support package.
 * Logic: 
 * 1. Initial Grace (graceMinutes): If total time <= this, session is FREE (0 min).
 * 2. Tolerance Threshold (graceFinal): If excess over block <= this, block is IGNORED.
 * 3. Ceiling Rounding: Otherwise, round UP to next block.
 * 4. Minimum: If it passes initial grace, it bills at least 1 block.
 */
function calculateBillableDuration(actualMs: number, pkg: SupportPackage | null): number {
    if (!pkg) return actualMs;

    const actualMin = actualMs / 60000;
    const graceInitial = pkg.graceMinutes || 0;
    const graceFinal = pkg.graceFinal || 0;
    const multiple = pkg.roundingMultiple || 1;

    // 1. Check Initial Grace (Absolute exclusion)
    if (actualMin <= graceInitial) {
        return 0;
    }

    // 2. Calculate complete blocks and the remaining residue
    const completeBlocks = Math.floor(actualMin / multiple);
    const residue = actualMin % multiple;

    // 3. Apply tolerance logic
    if (residue <= graceFinal) {
        // If residue is within tolerance, we stay at the floor (complete blocks)
        // Ensure at least 1 block is billed if it passed initial grace
        return Math.max(1, completeBlocks) * multiple * 60000;
    } else {
        // Round up to next block
        return (completeBlocks + 1) * multiple * 60000;
    }
}

/**
 * Helper to find the support package assigned to a ticket's customer.
 */
async function getPackageForTicket(db: Database, ticketId: number): Promise<SupportPackage | null> {
    try {
        const ticketRow = db.prepare(`
            SELECT c.supportPackageId 
            FROM tickets t
            JOIN customers c ON t.customerName = c.name
            WHERE t.id = ?
        `).get(ticketId) as { supportPackageId: string } | undefined;

        if (ticketRow?.supportPackageId) {
            const companySettings = await getCompanySettings();
            return companySettings.supportPackages.find(p => p.id === ticketRow.supportPackageId) || null;
        }
    } catch (e) {
        console.error("Failed to fetch support package for rounding logic:", e);
    }
    return null;
}

/**
 * Adds a new time entry. If duration is provided (manual entry), 
 * it automatically calculates the billable duration based on the customer's package.
 */
export async function addTimeEntry(payload: Partial<Omit<TimeEntry, 'id'|'createdAt'>>): Promise<TimeEntry> {
    const db = await connectDb();
    const now = new Date().toISOString();
    const { ticketId, userId, startTime, endTime, duration, notes, isBillable } = payload;
    
    let billableDuration = duration || null;

    // If it's a manual entry (has duration), calculate billable time immediately
    if (duration && ticketId) {
        const pkg = await getPackageForTicket(db, ticketId);
        billableDuration = calculateBillableDuration(duration, pkg);
    }
    
    const info = db.prepare(`
        INSERT INTO time_entries (ticketId, userId, startTime, endTime, duration, billableDuration, notes, isBillable, billingStatus, createdAt)
        VALUES (@ticketId, @userId, @startTime, @endTime, @duration, @billableDuration, @notes, @isBillable, 'pending', @createdAt)
    `).run({
        ticketId, userId, startTime,
        endTime: endTime || null,
        duration: duration || null,
        billableDuration,
        notes: notes || null,
        isBillable: isBillable === false ? 0 : 1,
        createdAt: now
    });

    return db.prepare('SELECT * FROM time_entries WHERE id = ?').get(info.lastInsertRowid) as TimeEntry;
}

export async function getEntriesForTicket(ticketId: number): Promise<TimeEntry[]> {
    const db = await connectDb();
    const rows = db.prepare('SELECT * FROM time_entries WHERE ticketId = ? ORDER BY createdAt DESC').all(ticketId) as (Omit<TimeEntry, 'isBillable'> & { isBillable: number })[];
    return rows.map(r => ({
        ...r,
        isBillable: !!r.isBillable
    })) as TimeEntry[];
}

/**
 * Stops an active timer and calculates the final durations.
 */
export async function stopTimeEntry(entryId: number, notes: string, isBillable: boolean): Promise<TimeEntry> {
    const db = await connectDb();
    const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry | undefined;
    if (!entry || entry.endTime) throw new Error('Entrada no válida o ya detenida.');

    const endTime = new Date();
    const startTime = new Date(entry.startTime);
    const actualDuration = endTime.getTime() - startTime.getTime();
    
    const pkg = await getPackageForTicket(db, entry.ticketId);
    const billableDuration = calculateBillableDuration(actualDuration, pkg);

    db.prepare(`UPDATE time_entries SET endTime = ?, duration = ?, billableDuration = ?, notes = ?, isBillable = ? WHERE id = ?`)
      .run(endTime.toISOString(), actualDuration, billableDuration, notes, isBillable ? 1 : 0, entryId);
    
    const result = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as (Omit<TimeEntry, 'isBillable'> & { isBillable: number });
    return { ...result, isBillable: !!result.isBillable } as TimeEntry;
}

export async function deleteTimeEntry(entryId: number): Promise<void> {
    const db = await connectDb();
    db.prepare('DELETE FROM time_entries WHERE id = ?').run(entryId);
}
