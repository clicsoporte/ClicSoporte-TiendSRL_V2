'use server';

/**
 * @fileoverview Maintenance Server Actions for database auditing and legacy migrations.
 */

import { connectDb } from "./db";
import { MASTER_SCHEMA } from "./schema";
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { logInfo, logError, logWarn } from "./logger";

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
        } catch {
            results.push({ table: tableName, status: 'missing_table', missingColumns: expectedColumns });
        }
    }

    return results;
}

/**
 * Detects legacy .db files in the dbs directory.
 */
export async function detectLegacyFiles(): Promise<string[]> {
    const dbDir = path.join(process.cwd(), 'dbs');
    if (!fs.existsSync(dbDir)) return [];
    
    const files = fs.readdirSync(dbDir);
    const legacyFiles = [
        'contracts.db', 'tickets.db', 'planner.db', 'licenses.db', 
        'it_tools.db', 'cost_assistant.db', 'notifications.db', 
        'warehouse.db', 'requests.db'
    ];
    
    return files.filter(f => legacyFiles.includes(f));
}

/**
 * Migrates data from legacy fragmentated databases into the unified intratool.db.
 */
export async function runLegacyMigration(): Promise<{ success: boolean, message: string }> {
    const legacyFiles = await detectLegacyFiles();
    if (legacyFiles.length === 0) {
        return { success: false, message: "No se detectaron archivos de base de datos antiguos." };
    }

    const mainDb = await connectDb();
    const dbDir = path.join(process.cwd(), 'dbs');
    let totalMigrated = 0;

    try {
        for (const file of legacyFiles) {
            const legacyPath = path.join(dbDir, file);
            const legacyDb = new Database(legacyPath);
            
            try {
                if (file === 'tickets.db') {
                    const tickets = legacyDb.prepare('SELECT * FROM tickets').all() as any[];
                    const threads = legacyDb.prepare('SELECT * FROM ticket_threads').all() as any[];
                    
                    const insertTicket = mainDb.prepare(`INSERT OR IGNORE INTO tickets (id, consecutive, subject, status, priority, createdAt, updatedAt, customerName, customerEmail, assigneeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                    const insertThread = mainDb.prepare(`INSERT OR IGNORE INTO ticket_threads (id, ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                    
                    mainDb.transaction(() => {
                        tickets.forEach(t => insertTicket.run(t.id, t.consecutive, t.subject, t.status, t.priority, t.createdAt, t.updatedAt, t.customerName, t.customerEmail, t.assigneeId));
                        threads.forEach(th => insertThread.run(th.id, th.ticketId, th.userId, th.userName, th.type, th.content, th.createdAt));
                    })();
                    totalMigrated += tickets.length;
                }

                if (file === 'it_tools.db') {
                    const notes = legacyDb.prepare('SELECT * FROM it_notes').all() as any[];
                    const insertNote = mainDb.prepare(`INSERT OR IGNORE INTO it_notes (id, title, content, customerId, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                    mainDb.transaction(() => {
                        notes.forEach(n => insertNote.run(n.id, n.title, n.content, n.customerId, n.createdBy, n.createdAt, n.updatedAt));
                    })();
                    totalMigrated += notes.length;
                }

                // Add other legacy migrations as needed (contracts, etc)
                
                // Backup legacy file before deleting
                fs.copyFileSync(legacyPath, `${legacyPath}.migrated.bak`);
                fs.unlinkSync(legacyPath);
                
                await logInfo(`Migración exitosa del archivo legado: ${file}`);
            } catch (err) {
                await logWarn(`Falla parcial al migrar ${file}: ${(err as Error).message}`);
            } finally {
                legacyDb.close();
            }
        }

        return { success: true, message: `Migración completada. Se procesaron ${totalMigrated} registros de legado.` };
    } catch (error: unknown) {
        const err = error as Error;
        await logError("Falla crítica en migrador de legado", { error: err.message });
        return { success: false, message: `Error: ${err.message}` };
    }
}
