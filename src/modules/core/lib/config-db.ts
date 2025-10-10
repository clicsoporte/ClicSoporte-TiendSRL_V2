
/**
 * @fileoverview This file contains server-side functions specifically for reading
 * configuration from the database. It is separated to avoid circular dependencies.
 * ALL FUNCTIONS IN THIS FILE ARE SERVER-ONLY.
 */
"use server";

import { connectDb } from './db';
import type { SqlConfig, ImportQuery } from '../types';

/**
 * Retrieves the SQL Server connection configuration from the database.
 * @returns {Promise<SqlConfig | null>} The SQL configuration object, or null if not found.
 */
export async function getSqlConfig(): Promise<SqlConfig | null> {
    const db = await connectDb();
    try {
        const rows = db.prepare('SELECT key, value FROM sql_config').all() as {key: string, value: string}[];
        if (!rows || rows.length === 0) {
            // If there's no config in the DB, it hasn't been saved yet.
            return null;
        }
        const config: SqlConfig = {};
        for (const row of rows) {
            config[row.key as keyof SqlConfig] = row.value;
        }
        return config;
    } catch (error) {
        console.error("Failed to get SQL config:", error);
        return null;
    }
}

/**
 * Saves the SQL Server connection configuration to the database.
 * @param {SqlConfig} config - The configuration object to save.
 */
export async function saveSqlConfig(config: SqlConfig): Promise<void> {
    const db = await connectDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO sql_config (key, value) VALUES (?, ?)');
    const transaction = db.transaction((conf) => {
        for (const key in conf) {
            upsert.run(key, conf[key as keyof SqlConfig]);
        }
    });
    transaction(config);
}

/**
 * Retrieves all import queries from the database.
 * @returns {Promise<ImportQuery[]>} A promise that resolves to an array of import queries.
 */
export async function getImportQueries(): Promise<ImportQuery[]> {
    const db = await connectDb();
    try {
        const rows = db.prepare('SELECT * FROM import_queries').all() as ImportQuery[];
        return rows || [];
    } catch (error) {
        console.error("Failed to get import queries:", error);
        return [];
    }
}

/**
 * Saves the SQL import queries to the database.
 * @param {ImportQuery[]} queries - The array of queries to save.
 */
export async function saveImportQueries(queries: ImportQuery[]): Promise<void> {
    const db = await connectDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO import_queries (type, query) VALUES (?, ?)');
    const transaction = db.transaction((qs) => {
        for (const q of qs) {
            upsert.run(q.type, q.query);
        }
    });
    transaction(queries);
}
