/**
 * @fileoverview Server-side database functions for the quoter module.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { QuoteDraft } from '../../core/types';
import { logError } from '../../core/lib/logger';
import { authorizeAction } from '@/modules/core/lib/auth-guard';

export async function saveQuoteDraft(draft: QuoteDraft): Promise<void> {
    await authorizeAction('quotes:drafts:create');
    try {
        const db = await connectDb();
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
    } catch (error: unknown) {
        const err = error as Error;
        await logError("Falla al guardar borrador de cotización", { 
            message: err.message, 
            id: draft.id,
            userId: draft.userId 
        });
        throw new Error(`No se pudo guardar el borrador: ${err.message}`);
    }
}

export async function getAllQuoteDrafts(userId: number): Promise<QuoteDraft[]> {
    await authorizeAction('quotes:drafts:read');
    const db = await connectDb();
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
    await authorizeAction('quotes:drafts:delete');
    const db = await connectDb();
    db.prepare('DELETE FROM quote_drafts WHERE id = ?').run(draftId);
}
