/**
 * @fileoverview Generic SQLite database connection management.
 * This file is intended to be a low-level utility that does not depend on
 * business logic or high-level registries, preventing circular dependencies.
 */
"use server";

import path from 'path';
import fs from 'fs';
import type { Database } from 'better-sqlite3';

const dbDirectory = path.join(process.cwd(), 'dbs');
const dbConnections = new Map<string, Database>();

export type InitFn = (db: Database) => Promise<void> | void;
export type MigrationFn = (db: Database) => Promise<void> | void;

/**
 * Establishes a connection to a specific SQLite database file.
 * Handles automatic initialization and potential restoration from backups.
 */
export async function connectDb(
    dbFile: string, 
    initFn?: InitFn, 
    migrationFn?: MigrationFn
): Promise<Database> {
    if (dbConnections.has(dbFile) && dbConnections.get(dbFile)!.open) {
        return dbConnections.get(dbFile)!;
    }
    
    if (!fs.existsSync(dbDirectory)) {
        fs.mkdirSync(dbDirectory, { recursive: true });
    }

    const dbPath = path.join(dbDirectory, dbFile);
    const restoreFilePath = `${dbPath}_restore.db`;

    // Handle database restoration if a restore marker exists
    if (fs.existsSync(restoreFilePath)) {
        try {
            if (dbConnections.has(dbFile) && dbConnections.get(dbFile)?.open) {
                dbConnections.get(dbFile)!.close();
                dbConnections.delete(dbFile);
            }
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, `${dbPath}.bak`);
                fs.unlinkSync(dbPath);
            }
            fs.renameSync(restoreFilePath, dbPath);
        } catch(e: unknown) {
            console.error(`Failed to apply restore for ${dbFile}: ${(e as Error).message}`);
            if (fs.existsSync(restoreFilePath)) fs.unlinkSync(restoreFilePath);
        }
    }

    // Dynamic import of better-sqlite3 to prevent it from being bundled into client components
    // and to avoid "reading 'call'" errors during module resolution.
    const DatabaseConstructor = (await import('better-sqlite3')).default;

    let db: Database;
    const exists = fs.existsSync(dbPath);

    try {
        db = new DatabaseConstructor(dbPath) as Database;
        db.pragma('journal_mode = WAL');
    } catch (error) {
        console.error(`Database ${dbFile} connection failed.`, error);
        throw error;
    }

    // Run initialization if the database is new
    if (!exists && initFn) {
        try {
            await initFn(db);
        } catch (error) {
            console.error(`Failed to initialize database ${dbFile}:`, error);
        }
    }

    // Always attempt migrations
    if (migrationFn) {
        try {
            await migrationFn(db);
        } catch (error) {
            console.error(`Migration failed for ${dbFile}:`, error);
        }
    }

    dbConnections.set(dbFile, db);
    return db;
}
