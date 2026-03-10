/**
 * @fileoverview Server-side database functions for the quoter module.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { QuoteDraft } from '../../core/types';

const DB_FILE = 'intratool.db'; // Using main DB for drafts

export async function saveQuoteDraft(draft: QuoteDraft): Promise<void> {
    const db = await connectDb(DB_FILE);
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO quote_drafts 
        (id, createdAt, userId, customerId, customerDetails, lines, totals, notes, currency, exchangeRate, purchaseOrderNumber, deliveryAddress, deliveryDate, sellerName, sellerType, quoteDate, validUntilDate, paymentTerms, creditDays)
        VALUES (@id, @createdAt, @userId, @customerId, @customerDetails, @lines, @totals, @notes, @currency, @exchangeRate, @purchaseOrderNumber, @deliveryAddress, @deliveryDate, @sellerName, @sellerType, @quoteDate, @validUntilDate, @paymentTerms, @creditDays)
    `);

    stmt.run({
        ...draft,
        lines: JSON.stringify(draft.lines),
        totals: JSON.stringify(draft.totals),
    });
}

export async function getAllQuoteDrafts(userId: number): Promise<QuoteDraft[]> {
    const db = await connectDb(DB_FILE);
    const results = db.prepare('SELECT * FROM quote_drafts WHERE userId = ? ORDER BY createdAt DESC').all(userId) as Record<string, unknown>[];
    
    // Ensure all nested JSON is parsed correctly.
    const parsedResults = results.map(draft => ({
        ...draft,
        lines: JSON.parse((draft.lines as string) || '[]'),
        totals: JSON.parse((draft.totals as string) || '{}')
    }));

    return JSON.parse(JSON.stringify(parsedResults)) as QuoteDraft[];
}

export async function deleteQuoteDraft(draftId: string): Promise<void> {
    const db = await connectDb(DB_FILE);
    db.prepare('DELETE FROM quote_drafts WHERE id = ?').run(draftId);
}
