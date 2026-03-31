/**
 * @fileoverview Server-side functions for the cost assistant module.
 * Unified into intratool.db. Tables prefixed with cost_assistant_.
 */
"use server";

import { connectDb } from '@/modules/core/lib/db';
import type { CostAnalysisDraft, CostAssistantSettings } from '@/modules/core/types';

export async function getAllDrafts(userId: number): Promise<CostAnalysisDraft[]> {
    const db = await connectDb();
    try {
        const rows = db.prepare(`SELECT * FROM cost_drafts WHERE userId = ? ORDER BY createdAt DESC`).all(userId) as { id: string; userId: number; name: string; createdAt: string; data: string; }[];
        return rows.map(row => {
            const data = JSON.parse(row.data);
            return { id: row.id, userId: row.userId, name: row.name, createdAt: row.createdAt, ...data };
        });
    } catch (error) {
        console.error("Failed to get drafts:", error);
        return [];
    }
}

export async function saveDraft(draft: Omit<CostAnalysisDraft, 'id' | 'createdAt'>, draftPrefix: string, nextDraftNumber: number): Promise<CostAnalysisDraft> {
    const db = await connectDb();
    const id = `${draftPrefix}${String(nextDraftNumber).padStart(5, '0')}`;
    const createdAt = new Date().toISOString();
    const { userId, name, ...dataToStore } = draft;

    db.prepare(`INSERT OR REPLACE INTO cost_drafts (id, userId, name, data, createdAt) VALUES (?, ?, ?, ?, ?)`).run(id, userId, name, JSON.stringify(dataToStore), createdAt);
    db.prepare(`UPDATE cost_assistant_settings SET value = ? WHERE key = 'nextDraftNumber'`).run(nextDraftNumber + 1);
    
    return { id, createdAt, ...draft };
}

export async function deleteDraft(id: string): Promise<void> {
    const db = await connectDb();
    db.prepare(`DELETE FROM cost_drafts WHERE id = ?`).run(id);
}

export async function getCostAssistantDbSettings(): Promise<Partial<CostAssistantSettings>> {
    const db = await connectDb();
    const settings: Partial<CostAssistantSettings> = {};
    try {
        const rows = db.prepare(`SELECT key, value FROM cost_assistant_settings`).all() as {key: string, value: string}[];
        for (const row of rows) {
            if (row.key === 'draftPrefix') settings.draftPrefix = row.value;
            else if (row.key === 'nextDraftNumber') settings.nextDraftNumber = Number(row.value);
        }
    } catch (error) {
        return { draftPrefix: 'AC-', nextDraftNumber: 1 };
    }
    return settings;
}

export async function saveCostAssistantDbSettings(settings: Partial<CostAssistantSettings>): Promise<void> {
    const db = await connectDb();
    const transaction = db.transaction(() => {
        if (settings.draftPrefix !== undefined) db.prepare(`INSERT OR REPLACE INTO cost_assistant_settings (key, value) VALUES ('draftPrefix', ?)`).run(settings.draftPrefix);
        if (settings.nextDraftNumber !== undefined) db.prepare(`INSERT OR REPLACE INTO cost_assistant_settings (key, value) VALUES ('nextDraftNumber', ?)`).run(settings.nextDraftNumber);
    });
    transaction();
}
