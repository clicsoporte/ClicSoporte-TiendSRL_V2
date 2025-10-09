/**
 * @fileoverview Server-side functions for accessing master data like customers, products, etc.
 * Separated to avoid circular dependencies.
 */
"use server";

import { connectDb } from './db';
import type { Product, Customer, StockInfo, Exemption } from '@/modules/core/types';

/**
 * Retrieves all customers from the database.
 * @returns {Promise<Customer[]>}
 */
export async function getAllCustomers(): Promise<Customer[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM customers').all() as Customer[];
    } catch (error) {
        console.error("Failed to get all customers:", error);
        return [];
    }
}

/**
 * Retrieves all products from the database.
 * @returns {Promise<Product[]>}
 */
export async function getAllProducts(): Promise<Product[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM products').all() as Product[];
    } catch (error) {
        console.error("Failed to get all products:", error);
        return [];
    }
}

/**
 * Retrieves all stock information from the database.
 * @returns {Promise<StockInfo[]>}
 */
export async function getAllStock(): Promise<StockInfo[]> {
    const db = await connectDb();
    try {
        const stockData = db.prepare('SELECT * FROM stock').all() as { itemId: string; stockByWarehouse: string; totalStock: number }[];
        return stockData.map(item => ({
            ...item,
            stockByWarehouse: JSON.parse(item.stockByWarehouse),
        }));
    } catch (error) {
        console.error("Failed to get all stock:", error);
        return [];
    }
}

/**
 * Retrieves all exemptions from the database.
 * @returns {Promise<Exemption[]>}
 */
export async function getAllExemptions(): Promise<Exemption[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM exemptions').all() as Exemption[];
    } catch (error) {
        console.error("Failed to get all exemptions:", error);
        return [];
    }
}

/**
 * Retrieves the full CABYS catalog from the database.
 * @returns {Promise<{code: string, description: string, taxRate: number}[]>}
 */
export async function getCabysCatalog(): Promise<{code: string, description: string, taxRate: number}[]> {
    const db = await connectDb();
    try {
        return db.prepare('SELECT * FROM cabys_catalog').all() as {code: string, description: string, taxRate: number}[];
    } catch (error) {
        console.error("Failed to get CABYS catalog:", error);
        return [];
    }
}
