/**
 * @fileoverview Server-side functions for managing stock settings (warehouses).
 * Separated to avoid circular dependencies.
 */
"use server";

import { connectDb } from './db';
import type { StockSettings } from '../types';

/**
 * Retrieves the stock settings (warehouses) from the database.
 * @returns {Promise<StockSettings>} The stock settings object.
 */
export async function getStockSettings(): Promise<StockSettings> {
    const db = await connectDb();
    try {
        const row = db.prepare("SELECT value FROM stock_settings WHERE key = 'warehouses'").get() as { value: string } | undefined;
        if (row) {
            return { warehouses: JSON.parse(row.value) };
        }
    } catch (error) {
        console.error("Failed to get stock settings, returning default.", error);
    }
    return { warehouses: [] };
}

/**
 * Saves the stock settings (warehouses) to the database.
 * @param {StockSettings} settings - The settings to save.
 */
export async function saveStockSettings(settings: StockSettings): Promise<void> {
    const db = await connectDb();
    db.prepare("INSERT OR REPLACE INTO stock_settings (key, value) VALUES ('warehouses', ?)").run(JSON.stringify(settings.warehouses));
}
