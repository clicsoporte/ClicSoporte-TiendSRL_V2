'use server';

/**
 * @fileoverview Server actions for the Billing Management module.
 */

import { connectDb } from '@/modules/core/lib/db';
import type { TimeEntry } from '@/modules/core/types';
import { getCompanySettings } from '@/modules/core/lib/settings-db';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { revalidatePath } from 'next/cache';

export interface PendingCustomer {
    id: string;
    name: string;
    taxId: string;
    pendingCount: number;
    totalAmount: number;
    currency: string;
}

interface DbBillingRow extends TimeEntry {
    customerId: string;
    customerName: string;
    taxId: string;
    entryId: number;
    ticketConsecutive: string;
    serviceId: string;
}

/**
 * Retrieves a list of customers with pending billable time entries.
 */
export async function getCustomersWithPendingBilling(): Promise<PendingCustomer[]> {
    const db = await connectDb();
    const settings = await getCompanySettings();
    const serviceMap = new Map(settings.servicesCatalog.map(s => [s.id, s]));

    try {
        // Query all pending billable entries joined with tickets and customers
        const rows = db.prepare(`
            SELECT 
                c.id as customerId,
                c.name as customerName,
                c.taxId,
                te.id as entryId,
                te.billableDuration,
                te.duration,
                t.serviceId
            FROM time_entries te
            JOIN tickets t ON te.ticketId = t.id
            JOIN customers c ON (t.customerName = c.name OR t.companyName = c.name OR t.id = c.id)
            WHERE te.billingStatus = 'pending' AND te.isBillable = 1
        `).all() as (Pick<DbBillingRow, 'customerId' | 'customerName' | 'taxId' | 'billableDuration' | 'duration' | 'serviceId'>)[];

        const customerMap = new Map<string, PendingCustomer>();

        rows.forEach(row => {
            const service = serviceMap.get(row.serviceId);
            const price = service?.price || 0;
            const billingType = service?.billingType || 'hour';
            
            let amount = 0;
            if (billingType === 'task') {
                amount = price; // Flat fee
            } else {
                const durationMs = row.billableDuration !== null ? row.billableDuration : (row.duration || 0);
                amount = (durationMs / 3600000) * price;
            }

            if (!customerMap.has(row.customerId)) {
                customerMap.set(row.customerId, {
                    id: row.customerId,
                    name: row.customerName,
                    taxId: row.taxId,
                    pendingCount: 0,
                    totalAmount: 0,
                    currency: 'CRC' // Default
                });
            }

            const summary = customerMap.get(row.customerId)!;
            summary.pendingCount++;
            summary.totalAmount += amount;
        });

        return Array.from(customerMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    } catch (error) {
        console.error("Failed to fetch pending billing customers:", error);
        return [];
    }
}

/**
 * Retrieves entries for a specific customer filtered by billing status.
 */
export async function getBillingEntriesForCustomer(customerId: string, status: 'pending' | 'invoiced'): Promise<(TimeEntry & { ticketConsecutive: string, serviceName: string, price: number, amount: number })[]> {
    const db = await connectDb();
    const settings = await getCompanySettings();
    const serviceMap = new Map(settings.servicesCatalog.map(s => [s.id, s]));

    try {
        const rows = db.prepare(`
            SELECT 
                te.*,
                t.consecutive as ticketConsecutive,
                t.serviceId
            FROM time_entries te
            JOIN tickets t ON te.ticketId = t.id
            JOIN customers c ON (t.customerName = c.name OR t.companyName = c.name OR t.id = c.id)
            WHERE c.id = ? AND te.billingStatus = ? AND te.isBillable = 1
            ORDER BY te.startTime DESC
        `).all(customerId, status) as (TimeEntry & { ticketConsecutive: string, serviceId: string })[];

        return rows.map(row => {
            const service = serviceMap.get(row.serviceId);
            const price = service?.price || 0;
            const billingType = service?.billingType || 'hour';
            
            let amount = 0;
            if (billingType === 'task') {
                amount = price;
            } else {
                const durationMs = row.billableDuration !== null ? row.billableDuration : (row.duration || 0);
                amount = (durationMs / 3600000) * price;
            }

            return {
                ...row,
                isBillable: !!row.isBillable,
                serviceName: service?.name || 'Servicio General',
                price,
                amount
            };
        });
    } catch (error) {
        console.error("Failed to fetch billing entries for customer:", error);
        return [];
    }
}

/**
 * Retrieves all pending entries for a specific customer (legacy wrapper).
 */
export async function getPendingEntriesForCustomer(customerId: string) {
    return getBillingEntriesForCustomer(customerId, 'pending');
}

/**
 * Marks entries as invoiced.
 */
export async function markEntriesAsInvoiced(entryIds: number[], invoiceNumber: string): Promise<void> {
    const db = await connectDb();
    try {
        const placeholders = entryIds.map(() => '?').join(',');
        db.prepare(`
            UPDATE time_entries 
            SET billingStatus = 'invoiced', externalInvoiceNumber = ? 
            WHERE id IN (${placeholders})
        `).run(invoiceNumber, ...entryIds);

        await logInfo(`Bulk billing update: ${entryIds.length} entries marked as invoiced`, { invoiceNumber });
        revalidatePath('/dashboard/billing');
    } catch (error: unknown) {
        logError("Failed to mark entries as invoiced", { error: (error as Error).message });
        throw error;
    }
}
