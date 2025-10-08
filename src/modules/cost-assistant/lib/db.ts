/**
 * @fileoverview Server-side functions for the cost assistant database.
 */
"use server";

import { connectDb } from '../../core/lib/db';

const DB_FILE = 'cost-assistant.db';

export async function initializeCostAssistantDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS cost_analysis_drafts (
            id TEXT PRIMARY KEY,
            createdAt TEXT NOT NULL,
            userId INTEGER NOT NULL,
            name TEXT,
            lines TEXT,
            globalCosts TEXT
        );
    `;
    db.exec(schema);
    
    console.log(`Database ${DB_FILE} initialized for Cost Assistant.`);
}

export async function runCostAssistantMigrations(db: import('better-sqlite3').Database) {
    // No migrations needed for the initial version.
}

    