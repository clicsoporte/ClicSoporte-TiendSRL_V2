/**
 * @fileoverview Server-side functions for the cost assistant database.
 */
"use server";

import { connectDb } from '../../core/lib/db';
import type { CostAnalysisDraft } from '@/modules/core/types';
import crypto from 'crypto';

const DB_FILE = 'cost-assistant.db';

export type CostAssistantSettings = {
    columnVisibility: {
        cabysCode: boolean;
        supplierCode: boolean;
        description: boolean;
        quantity: boolean;
        unitCostWithoutTax: boolean;
        unitCostWithTax: boolean;
        taxRate: boolean;
        margin: boolean;
        sellPriceWithoutTax: boolean;
        finalSellPrice: boolean;
        profitPerLine: boolean;
    }
};

export async function initializeCostAssistantDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS cost_analysis_drafts (
            id TEXT PRIMARY KEY,
            createdAt TEXT NOT NULL,
            userId INTEGER NOT NULL,
            name TEXT,
            lines TEXT,
            globalCosts TEXT,
            processedInvoices TEXT
        );

        CREATE TABLE IF NOT EXISTS cost_assistant_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `;
    db.exec(schema);
    
    // Insert default column visibility
    const initialColumnVisibility = {
        cabysCode: true,
        supplierCode: true,
        description: true,
        quantity: true,
        unitCostWithoutTax: true,
        unitCostWithTax: false,
        taxRate: true,
        margin: true,
        sellPriceWithoutTax: true,
        finalSellPrice: true,
        profitPerLine: true,
    };
    db.prepare(`INSERT OR IGNORE INTO cost_assistant_settings (key, value) VALUES ('columnVisibility', ?)`).run(JSON.stringify(initialColumnVisibility));

    console.log(`Database ${DB_FILE} initialized for Cost Assistant.`);
    await runCostAssistantMigrations(db);
}

export async function runCostAssistantMigrations(db: import('better-sqlite3').Database) {
    const settingsTable = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='cost_assistant_settings'`).get();
    if (!settingsTable) {
        db.exec(`
            CREATE TABLE cost_assistant_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
         const initialColumnVisibility = {
            cabysCode: true, supplierCode: true, description: true, quantity: true,
            unitCostWithoutTax: true, unitCostWithTax: false, taxRate: true,
            margin: true, sellPriceWithoutTax: true, finalSellPrice: true, profitPerLine: true
        };
        db.prepare(`INSERT OR IGNORE INTO cost_assistant_settings (key, value) VALUES ('columnVisibility', ?)`).run(JSON.stringify(initialColumnVisibility));
    }
    
    const draftsTableInfo = db.prepare(`PRAGMA table_info(cost_analysis_drafts)`).all() as { name: string }[];
    const draftColumns = new Set(draftsTableInfo.map(c => c.name));
    if (!draftColumns.has('processedInvoices')) {
        db.exec(`ALTER TABLE cost_analysis_drafts ADD COLUMN processedInvoices TEXT;`);
    }

}

export async function getCostAssistantSettings(): Promise<CostAssistantSettings> {
    const db = await connectDb(DB_FILE);
    const row = db.prepare(`SELECT value FROM cost_assistant_settings WHERE key = 'columnVisibility'`).get() as { value: string } | undefined;
    if (row) {
        return {
            columnVisibility: JSON.parse(row.value)
        }
    }
    // Return a default if not found
    return {
        columnVisibility: {
            cabysCode: true, supplierCode: true, description: true, quantity: true,
            unitCostWithoutTax: true, unitCostWithTax: false, taxRate: true,
            margin: true, sellPriceWithoutTax: true, finalSellPrice: true, profitPerLine: true
        }
    };
}

export async function saveCostAssistantSettings(settings: CostAssistantSettings): Promise<void> {
    const db = await connectDb(DB_FILE);
    db.prepare(`
        INSERT OR REPLACE INTO cost_assistant_settings (key, value) VALUES ('columnVisibility', ?)
    `).run(JSON.stringify(settings.columnVisibility));
}

export async function getAllDrafts(userId: number): Promise<CostAnalysisDraft[]> {
    const db = await connectDb(DB_FILE);
    const drafts = db.prepare('SELECT * FROM cost_analysis_drafts WHERE userId = ? ORDER BY createdAt DESC').all(userId) as any[];
    const parsedDrafts = drafts.map(draft => ({
        ...draft,
        lines: JSON.parse(draft.lines || '[]'),
        globalCosts: JSON.parse(draft.globalCosts || '{}'),
        processedInvoices: JSON.parse(draft.processedInvoices || '[]'),
    }));
    return JSON.parse(JSON.stringify(parsedDrafts));
}

export async function saveDraft(draft: Omit<CostAnalysisDraft, 'id' | 'createdAt'>): Promise<CostAnalysisDraft> {
    const db = await connectDb(DB_FILE);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const draftToSave = {
        id,
        createdAt,
        ...draft
    };

    db.prepare(`
        INSERT OR REPLACE INTO cost_analysis_drafts 
        (id, createdAt, userId, name, lines, globalCosts, processedInvoices) 
        VALUES (@id, @createdAt, @userId, @name, @lines, @globalCosts, @processedInvoices)
    `).run({
        ...draftToSave,
        lines: JSON.stringify(draftToSave.lines),
        globalCosts: JSON.stringify(draftToSave.globalCosts),
        processedInvoices: JSON.stringify(draftToSave.processedInvoices),
    });
    
    const result = db.prepare('SELECT * FROM cost_analysis_drafts WHERE id = ?').get(id);
    return JSON.parse(JSON.stringify(result));
}

export async function deleteDraft(id: string): Promise<void> {
    const db = await connectDb(DB_FILE);
    db.prepare('DELETE FROM cost_analysis_drafts WHERE id = ?').run(id);
}
