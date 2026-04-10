
/**
 * @fileoverview Funciones de servidor para acceder a datos maestros (clientes, productos, etc.).
 */
"use server";

import { connectDb } from './db';
import type { Product, Customer, StockInfo, Exemption } from '@/modules/core/types';
import { logInfo, logError } from './logger';
import { authorizeAction } from './auth-guard';
import { getCurrentUser } from './session';
import { permissionTree } from './permissions';

/**
 * Ayudante para verificar permisos granulares de forma recursiva en el servidor.
 */
async function hasGranularPermission(permission: string): Promise<boolean> {
    const user = await getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;

    const db = await connectDb();
    const roleRow = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(user.role) as { permissions: string } | undefined;
    if (!roleRow) return false;
    
    const userPermissions: string[] = JSON.parse(roleRow.permissions || '[]');
    if (userPermissions.includes('admin:all') || userPermissions.includes(permission)) return true;

    const searchInTree = (perms: string[]): boolean => {
        for (const p of perms) {
            if (p === permission) return true;
            const children = permissionTree[p] || [];
            if (searchInTree(children)) return true;
        }
        return false;
    };
    return searchInTree(userPermissions);
}

/**
 * Obtiene todos los clientes de la base de datos.
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
            districtId: c.districtId ? Number(c.districtId) : null,
            isBlocked: !!c.isBlocked,
            blockedReason: c.blockedReason as string | null
        }));
        return JSON.parse(JSON.stringify(enrichedResults));
    } catch (error) {
        console.error("Error al obtener clientes:", error);
        return [];
    }
}

/**
 * Crea o actualiza un cliente manualmente.
 */
export async function upsertCustomer(customer: Customer): Promise<Customer> {
    const db = await connectDb();
    
    const existing = db.prepare('SELECT id, supportPackageId FROM customers WHERE id = ?').get(customer.id) as { id: string, supportPackageId: string | null } | undefined;
    await authorizeAction(existing ? 'customers:update' : 'customers:create');

    if (existing && customer.supportPackageId !== existing.supportPackageId) {
        const canUpdatePlan = await hasGranularPermission('customers:update:plan');
        if (!canUpdatePlan) {
            throw new Error("No tienes permiso para modificar el plan de soporte del cliente.");
        }
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO customers (
                id, name, commercialName, address, phone, taxId, currency, creditLimit, paymentCondition, salesperson, active, email, electronicDocEmail, isManual, contacts,
                taxRegime, taxStatus, isTaxMoroso, isTaxOmiso, taxAdministration, taxActivities,
                provinceId, cantonId, districtId, supportPackageId, telegramChatId, isBlocked, blockedReason
            )
            VALUES (
                @id, @name, @commercialName, @address, @phone, @taxId, @currency, @creditLimit, @paymentCondition, @salesperson, @active, @email, @electronicDocEmail, 1, @contacts,
                @taxRegime, @taxStatus, @isTaxMoroso, @isTaxOmiso, @taxAdministration, @taxActivities,
                @provinceId, @cantonId, @districtId, @supportPackageId, @telegramChatId, @isBlocked, @blockedReason
            )
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name, commercialName = excluded.commercialName, address = excluded.address, phone = excluded.phone, taxId = excluded.taxId, currency = excluded.currency,
                creditLimit = excluded.creditLimit, paymentCondition = excluded.paymentCondition, salesperson = excluded.salesperson, active = excluded.active,
                email = excluded.email, electronicDocEmail = excluded.electronicDocEmail, contacts = excluded.contacts,
                taxRegime = excluded.taxRegime, taxStatus = excluded.taxStatus, isTaxMoroso = excluded.isTaxMoroso, isTaxOmiso = excluded.isTaxOmiso,
                taxAdministration = excluded.taxAdministration, taxActivities = excluded.taxActivities,
                provinceId = excluded.provinceId, cantonId = excluded.cantonId, districtId = excluded.districtId,
                supportPackageId = excluded.supportPackageId, telegramChatId = excluded.telegramChatId,
                isBlocked = excluded.isBlocked, blockedReason = excluded.blockedReason
        `);
        
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
            districtId: customer.districtId || null,
            supportPackageId: customer.supportPackageId || null,
            telegramChatId: customer.telegramChatId || null,
            isBlocked: customer.isBlocked ? 1 : 0,
            blockedReason: customer.blockedReason || null
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
 * Elimina un cliente. Requiere permiso customers:delete.
 */
export async function deleteCustomer(id: string): Promise<void> {
    await authorizeAction('customers:delete');
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
 * Obtiene todos los artículos.
 */
export async function getAllProducts(): Promise<Product[]> {
    const db = await connectDb();
    try {
        const results = db.prepare('SELECT * FROM products').all() as Product[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Error al obtener productos:", error);
        return [];
    }
}

/**
 * Obtiene los niveles de existencias.
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
        console.error("Error al obtener existencias:", error);
        return [];
    }
}

/**
 * Obtiene todas las exoneraciones.
 */
export async function getAllExemptions(): Promise<Exemption[]> {
    const db = await connectDb();
    try {
        const results = db.prepare('SELECT * FROM exemptions').all() as Exemption[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Error al obtener exoneraciones:", error);
        return [];
    }
}

/**
 * Obtiene el catálogo CABYS completo.
 */
export async function getCabysCatalog(): Promise<{code: string, description: string, taxRate: number}[]> {
    const db = await connectDb();
    try {
        const results = db.prepare('SELECT * FROM cabys_catalog').all() as {code: string, description: string, taxRate: number}[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Error al obtener catálogo CABYS:", error);
        return [];
    }
}
