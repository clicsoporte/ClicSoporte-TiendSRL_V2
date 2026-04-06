
'use server';

/**
 * @fileoverview Maintenance Server Actions for database auditing.
 */

import { connectDb } from "./db";
import { MASTER_SCHEMA } from "./schema";

export type AuditResult = {
    table: string;
    status: 'ok' | 'missing_table' | 'missing_columns';
    missingColumns: string[];
};

/**
 * Compares the current database structure against the master schema.
 */
export async function runDatabaseAudit(): Promise<AuditResult[]> {
    const db = await connectDb();
    const results: AuditResult[] = [];

    for (const [tableName, expectedColumns] of Object.entries(MASTER_SCHEMA)) {
        try {
            const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
            
            if (tableInfo.length === 0) {
                results.push({ table: tableName, status: 'missing_table', missingColumns: expectedColumns });
                continue;
            }

            const actualColumns = new Set(tableInfo.map(c => c.name));
            const missing = expectedColumns.filter(col => !actualColumns.has(col));

            if (missing.length > 0) {
                results.push({ table: tableName, status: 'missing_columns', missingColumns: missing });
            } else {
                results.push({ table: tableName, status: 'ok', missingColumns: [] });
            }
        } catch (error) {
            results.push({ table: tableName, status: 'missing_table', missingColumns: expectedColumns });
        }
    }

    return results;
}
