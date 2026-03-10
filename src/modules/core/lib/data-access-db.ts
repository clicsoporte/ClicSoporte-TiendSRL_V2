/**
 * @fileoverview Server-side functions for accessing master data like customers, products, etc.
 * Separated to avoid circular dependencies.
 */
"use server";

import { connectDb } from './db';
import type { Product, Customer, StockInfo, Exemption } from '@/modules/core/types';
import { logInfo } from './logger';

/**
 * Retrieves all customers from the database.
 * @returns {Promise<Customer[]>}
 */
export async function getAllCustomers(): Promise<Customer[]> {
    const db = await connectDb();
    try {
        const results = db.prepare('SELECT * FROM customers ORDER BY name ASC').all() as Customer[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Failed to get all customers:", error);
        return [];
    }
}

/**
 * Adds or updates a customer manually.
 */
export async function upsertCustomer(customer: Customer): Promise<Customer> {
    const db = await connectDb();
    const stmt = db.prepare(`
        INSERT INTO customers (id, name, address, phone, taxId, currency, creditLimit, paymentCondition, salesperson, active, email, electronicDocEmail, isManual)
        VALUES (@id, @name, @address, @phone, @taxId, @currency, @creditLimit, @paymentCondition, @salesperson, @active, @email, @electronicDocEmail, 1)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, address = excluded.address, phone = excluded.phone, taxId = excluded.taxId, currency = excluded.currency,
            creditLimit = excluded.creditLimit, paymentCondition = excluded.paymentCondition, salesperson = excluded.salesperson, active = excluded.active,
            email = excluded.email, electronicDocEmail = excluded.electronicDocEmail
    `);
    
    stmt.run(customer);
    await logInfo(`Cliente gestionado manualmente: ${customer.name} (${customer.id})`);
    return customer;
}

/**
 * Deletes a customer.
 */
export async function deleteCustomer(id: string): Promise<void> {
    const db = await connectDb();
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    await logInfo(`Cliente eliminado ID: ${id}`);
}

/**
 * Retrieves all products from the database.
 * @returns {Promise<Product[]>}
 */
export async function getAllProducts(): Promise<Product[]> {
    const db = await connectDb();
    try {
        const results = db.prepare('SELECT * FROM products').all() as Product[];
        return JSON.parse(JSON.stringify(results));
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
        const parsedData = stockData.map(item => ({
            ...item,
            stockByWarehouse: JSON.parse(item.stockByWarehouse),
        }));
        return JSON.parse(JSON.stringify(parsedData));
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
        const results = db.prepare('SELECT * FROM exemptions').all() as Exemption[];
        return JSON.parse(JSON.stringify(results));
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
        const results = db.prepare('SELECT * FROM cabys_catalog').all() as {code: string, description: string, taxRate: number}[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Failed to get CABYS catalog:", error);
        return [];
    }
}
