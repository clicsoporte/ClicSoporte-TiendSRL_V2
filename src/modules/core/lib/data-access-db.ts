
/**
 * @fileoverview Server-side functions for accessing master data like customers, products, etc.
 * Separated to avoid circular dependencies.
 */
"use server";

import { connectDb } from './db';
import type { Product, Customer, StockInfo, Exemption } from '@/modules/core/types';
import { logInfo, logError } from './logger';

/**
 * Retrieves all customers from the database.
 * @returns {Promise<Customer[]>}
 */
export async function getAllCustomers(): Promise<Customer[]> {
    const db = await connectDb();
    try {
        const results = db.prepare('SELECT * FROM customers ORDER BY name ASC').all() as Record<string, unknown>[];
        const enrichedResults = results.map(c => ({
            ...c,
            contacts: JSON.parse((c.contacts as string) || '[]'),
            isManual: !!c.isManual,
            isTaxMoroso: !!c.isTaxMoroso,
            isTaxOmiso: !!c.isTaxOmiso,
            provinceId: c.provinceId ? Number(c.provinceId) : null,
            cantonId: c.cantonId ? Number(c.cantonId) : null,
            districtId: c.districtId ? Number(c.districtId) : null
        }));
        return JSON.parse(JSON.stringify(enrichedResults));
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
    try {
        const stmt = db.prepare(`
            INSERT INTO customers (
                id, name, commercialName, address, phone, taxId, currency, creditLimit, paymentCondition, salesperson, active, email, electronicDocEmail, isManual, contacts,
                taxRegime, taxStatus, isTaxMoroso, isTaxOmiso, taxAdministration, taxActivities,
                provinceId, cantonId, districtId
            )
            VALUES (
                @id, @name, @commercialName, @address, @phone, @taxId, @currency, @creditLimit, @paymentCondition, @salesperson, @active, @email, @electronicDocEmail, 1, @contacts,
                @taxRegime, @taxStatus, @isTaxMoroso, @isTaxOmiso, @taxAdministration, @taxActivities,
                @provinceId, @cantonId, @districtId
            )
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name, commercialName = excluded.commercialName, address = excluded.address, phone = excluded.phone, taxId = excluded.taxId, currency = excluded.currency,
                creditLimit = excluded.creditLimit, paymentCondition = excluded.paymentCondition, salesperson = excluded.salesperson, active = excluded.active,
                email = excluded.email, electronicDocEmail = excluded.electronicDocEmail, contacts = excluded.contacts,
                taxRegime = excluded.taxRegime, taxStatus = excluded.taxStatus, isTaxMoroso = excluded.isTaxMoroso, isTaxOmiso = excluded.isTaxOmiso,
                taxAdministration = excluded.taxAdministration, taxActivities = excluded.taxActivities,
                provinceId = excluded.provinceId, cantonId = excluded.cantonId, districtId = excluded.districtId
        `);
        
        // Clean parameters to ensure no 'undefined' values reach SQLite
        const params = {
            id: customer.id,
            name: customer.name,
            commercialName: customer.commercialName || null,
            address: customer.address || null,
            phone: customer.phone || null,
            taxId: customer.taxId,
            currency: customer.currency || 'CRC',
            creditLimit: customer.creditLimit || 0,
            paymentCondition: customer.paymentCondition || '0',
            salesperson: customer.salesperson || null,
            active: customer.active || 'S',
            email: customer.email || null,
            electronicDocEmail: customer.electronicDocEmail || null,
            contacts: JSON.stringify(customer.contacts || []),
            taxRegime: customer.taxRegime || null,
            taxStatus: customer.taxStatus || null,
            isTaxMoroso: customer.isTaxMoroso ? 1 : 0,
            isTaxOmiso: customer.isTaxOmiso ? 1 : 0,
            taxAdministration: customer.taxAdministration || null,
            taxActivities: customer.taxActivities || '[]',
            provinceId: customer.provinceId || null,
            cantonId: customer.cantonId || null,
            districtId: customer.districtId || null
        };

        stmt.run(params);
        await logInfo(`Cliente gestionado manualmente: ${customer.name} (${customer.id})`);
        return customer;
    } catch (error: unknown) {
        const err = error as Error;
        await logError("Falla crítica al guardar cliente", { 
            message: err.message, 
            customerId: customer.id,
            taxId: customer.taxId 
        });
        throw new Error(`Error en el servidor al procesar el cliente: ${err.message}`);
    }
}

/**
 * Deletes a customer.
 */
export async function deleteCustomer(id: string): Promise<void> {
    const db = await connectDb();
    try {
        db.prepare('DELETE FROM customers WHERE id = ?').run(id);
        await logInfo(`Cliente eliminado ID: ${id}`);
    } catch (error: unknown) {
        const err = error as Error;
        await logError("Error al eliminar cliente", { error: err.message, id });
        throw err;
    }
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
