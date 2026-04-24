/**
 * @fileoverview Server Actions for the Inventory & Warranty module.
 * Implements high-performance search and CRUD for a 1GB RAM environment.
 * Robust parameter handling for SQLite.
 */
'use server';

import { connectDb } from "@/modules/core/lib/db";
import { authorizeAction } from "@/modules/core/lib/auth-guard";
import type { Equipment, SaleRecord, InventorySearchResult, Consumable } from "@/modules/core/types";
import { logError, logInfo } from "@/modules/core/lib/logger";
import { revalidatePath } from "next/cache";

/**
 * Omnibox search with hierarchical priority and pagination.
 */
export async function omniSearch(query: string, page: number = 1): Promise<{ 
    results: InventorySearchResult[], 
    hasMore: boolean,
    totalCount: number 
}> {
    await authorizeAction('inventory:read');
    const db = await connectDb();
    const limit = 10;
    const offset = (page - 1) * limit;
    const cleanQuery = `%${query.trim()}%`;

    try {
        if (page === 1) {
            const exactEquipment = db.prepare(`
                SELECT * FROM inventory_equipment WHERE serialNumber = ? OR id = ? LIMIT 1
            `).get(query.trim(), query.trim()) as Equipment | undefined;

            if (exactEquipment) {
                return { 
                    results: [{ type: 'equipment', data: exactEquipment }], 
                    hasMore: false, 
                    totalCount: 1 
                };
            }

            const exactSale = db.prepare(`
                SELECT * FROM inventory_sale_records WHERE invoiceNumber = ? LIMIT 1
            `).get(query.trim()) as SaleRecord | undefined;

            if (exactSale) {
                return { 
                    results: [{ type: 'warranty', data: exactSale }], 
                    hasMore: false, 
                    totalCount: 1 
                };
            }
        }

        const broadResults = db.prepare(`
            SELECT 'equipment' as type, e.id
            FROM inventory_equipment e
            LEFT JOIN customers c ON e.clientId = c.id
            WHERE e.nickname LIKE ? 
               OR e.brand LIKE ? 
               OR e.model LIKE ? 
               OR e.serialNumber LIKE ? 
               OR e.assignedUser LIKE ? 
               OR e.id LIKE ? 
               OR e.location LIKE ?
               OR c.name LIKE ? 
               OR c.commercialName LIKE ?
            UNION ALL
            SELECT 'warranty' as type, s.id
            FROM inventory_sale_records s
            LEFT JOIN customers c ON s.clientId = c.id
            WHERE s.invoiceNumber LIKE ? 
               OR s.serialNumber LIKE ? 
               OR s.productName LIKE ? 
               OR c.name LIKE ? 
               OR c.commercialName LIKE ?
            LIMIT ? OFFSET ?
        `).all(
            cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery,
            cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery,
            limit + 1, offset
        ) as { type: 'equipment' | 'warranty', id: string }[];

        const hasMore = broadResults.length > limit;
        const finalResults = broadResults.slice(0, limit).map(row => {
            if (row.type === 'equipment') {
                const data = db.prepare('SELECT * FROM inventory_equipment WHERE id = ?').get(row.id) as Equipment;
                return { type: 'equipment' as const, data };
            } else {
                const data = db.prepare('SELECT * FROM inventory_sale_records WHERE id = ?').get(row.id) as SaleRecord;
                return { type: 'warranty' as const, data };
            }
        });

        return { results: finalResults, hasMore, totalCount: 0 };
    } catch (error: unknown) {
        logError("OmniSearch failed", { error: (error as Error).message, query });
        return { results: [], hasMore: false, totalCount: 0 };
    }
}

export async function getEquipmentDetails(id: string) {
    await authorizeAction('inventory:read');
    const db = await connectDb();
    
    const equipment = db.prepare('SELECT * FROM inventory_equipment WHERE id = ?').get(id) as Equipment | undefined;
    if (!equipment) return null;

    const consumables = db.prepare('SELECT * FROM inventory_consumables WHERE equipmentId = ?').all(id) as Consumable[];
    const sales = db.prepare('SELECT * FROM inventory_sale_records WHERE equipmentId = ? OR serialNumber = ?').all(id, equipment.serialNumber) as SaleRecord[];

    return { ...equipment, consumables, saleRecords: sales };
}

export async function saveEquipment(data: Omit<Equipment, 'createdAt' | 'updatedAt'>, consumables?: Omit<Consumable, 'createdAt'>[]) {
    await authorizeAction('inventory:manage');
    const db = await connectDb();
    const now = new Date().toISOString();
    
    const transaction = db.transaction(() => {
        db.prepare(`
            INSERT INTO inventory_equipment (id, clientId, nickname, category, brand, model, serialNumber, location, assignedUser, status, notes, createdAt, updatedAt)
            VALUES (@id, @clientId, @nickname, @category, @brand, @model, @serialNumber, @location, @assignedUser, @status, @notes, @now, @now)
            ON CONFLICT(id) DO UPDATE SET
                clientId=@clientId, nickname=@nickname, category=@category, brand=@brand, model=@model, 
                serialNumber=@serialNumber, location=@location, assignedUser=@assignedUser, 
                status=@status, notes=@notes, updatedAt=@now
        `).run({ 
            id: data.id,
            clientId: data.clientId,
            nickname: data.nickname,
            category: data.category,
            brand: data.brand || '',
            model: data.model || '',
            serialNumber: data.serialNumber || null,
            location: data.location || null,
            assignedUser: data.assignedUser || null,
            status: data.status || 'active',
            notes: data.notes || null,
            now 
        });

        if (consumables) {
            db.prepare('DELETE FROM inventory_consumables WHERE equipmentId = ?').run(data.id);
            const insertConsumable = db.prepare(`
                INSERT INTO inventory_consumables (id, equipmentId, type, description, partNumber, brand, specs, isRecurring, lastReplaced, notes, createdAt)
                VALUES (@id, @equipmentId, @type, @description, @partNumber, @brand, @specs, @isRecurring, @lastReplaced, @notes, @now)
            `);

            for (const c of consumables) {
                insertConsumable.run({ 
                    id: c.id || Math.random().toString(36).substring(2, 15),
                    equipmentId: data.id,
                    type: c.type || 'other',
                    description: c.description || '',
                    partNumber: c.partNumber || '',
                    brand: c.brand || null,
                    specs: c.specs || null,
                    isRecurring: c.isRecurring ? 1 : 0,
                    lastReplaced: c.lastReplaced || null,
                    notes: c.notes || null,
                    now 
                });
            }
        }
    });

    try {
        transaction();
        await logInfo(`Equipment saved: ${data.nickname}`, { id: data.id });
        revalidatePath('/dashboard/inventory');
        return { success: true };
    } catch (e) {
        logError("Failed to save equipment", { error: (e as Error).message });
        throw e;
    }
}

export async function saveSaleRecord(data: Omit<SaleRecord, 'createdAt' | 'updatedAt'>) {
    await authorizeAction('inventory:manage');
    const db = await connectDb();
    const now = new Date().toISOString();
    
    try {
        db.prepare(`
            INSERT INTO inventory_sale_records (id, clientId, equipmentId, invoiceNumber, invoiceDate, productName, serialNumber, partNumber, warrantyMonths, warrantyExpiry, warrantyNotes, warrantyStatus, claimDate, claimNotes, createdAt, updatedAt)
            VALUES (@id, @clientId, @equipmentId, @invoiceNumber, @invoiceDate, @productName, @serialNumber, @partNumber, @warrantyMonths, @warrantyExpiry, @warrantyNotes, @warrantyStatus, @claimDate, @claimNotes, @now, @now)
            ON CONFLICT(id) DO UPDATE SET
                clientId=@clientId, equipmentId=@equipmentId, invoiceNumber=@invoiceNumber, invoiceDate=@invoiceDate, 
                productName=@productName, serialNumber=@serialNumber, partNumber=@partNumber, 
                warrantyMonths=@warrantyMonths, warrantyExpiry=@warrantyExpiry, warrantyNotes=@warrantyNotes, 
                warrantyStatus=@warrantyStatus, claimDate=@claimDate, claimNotes=@claimNotes, updatedAt=@now
        `).run({ 
            id: data.id,
            clientId: data.clientId,
            equipmentId: data.equipmentId ?? null,
            invoiceNumber: data.invoiceNumber,
            invoiceDate: data.invoiceDate,
            productName: data.productName ?? null,
            serialNumber: data.serialNumber,
            partNumber: data.partNumber ?? null,
            warrantyMonths: data.warrantyMonths,
            warrantyExpiry: data.warrantyExpiry,
            warrantyNotes: data.warrantyNotes ?? null,
            warrantyStatus: data.warrantyStatus,
            claimDate: data.claimDate ?? null,
            claimNotes: data.claimNotes ?? null,
            now 
        });

        await logInfo(`Sale record saved: ${data.invoiceNumber}`, { id: data.id });
        revalidatePath('/dashboard/inventory');
        return { success: true };
    } catch (e) {
        logError("Failed to save sale record", { error: (e as Error).message });
        throw e;
    }
}

export async function saveConsumable(data: Consumable) {
    await authorizeAction('inventory:manage');
    const db = await connectDb();
    const now = new Date().toISOString();
    
    db.prepare(`
        INSERT INTO inventory_consumables (id, equipmentId, type, description, partNumber, brand, specs, isRecurring, lastReplaced, notes, createdAt)
        VALUES (@id, @equipmentId, @type, @description, @partNumber, @brand, @specs, @isRecurring, @lastReplaced, @notes, @now)
        ON CONFLICT(id) DO UPDATE SET
            type=@type, description=@description, partNumber=@partNumber, brand=@brand, 
            specs=@specs, isRecurring=@isRecurring, lastReplaced=@lastReplaced, notes=@notes
    `).run({ 
        id: data.id,
        equipmentId: data.equipmentId,
        type: data.type,
        description: data.description,
        partNumber: data.partNumber,
        brand: data.brand || null,
        specs: data.specs || null,
        isRecurring: data.isRecurring ? 1 : 0,
        lastReplaced: data.lastReplaced || null,
        notes: data.notes || null,
        now 
    });
    
    return { success: true };
}

export async function deleteEquipment(id: string) {
    await authorizeAction('inventory:manage');
    const db = await connectDb();
    db.prepare('DELETE FROM inventory_equipment WHERE id = ?').run(id);
    revalidatePath('/dashboard/inventory');
}

export async function getEquipmentByClient(clientId: string): Promise<Equipment[]> {
    await authorizeAction('inventory:read');
    const db = await connectDb();
    return db.prepare('SELECT * FROM inventory_equipment WHERE clientId = ? ORDER BY nickname').all(clientId) as Equipment[];
}

export async function getAllSaleRecords(page: number = 1, limit: number = 20, search: string = ""): Promise<{ data: SaleRecord[], hasMore: boolean }> {
    await authorizeAction('inventory:warranty:hub');
    const db = await connectDb();
    const offset = (page - 1) * limit;
    const cleanSearch = `%${search.trim()}%`;
    
    try {
        let query = 'SELECT * FROM inventory_sale_records';
        const params: (string | number)[] = [];
        
        if (search.trim()) {
            query += ' WHERE invoiceNumber LIKE ? OR serialNumber LIKE ? OR productName LIKE ?';
            params.push(cleanSearch, cleanSearch, cleanSearch);
        }
        
        query += ' ORDER BY warrantyExpiry ASC LIMIT ? OFFSET ?';
        params.push(limit + 1, offset);

        const rows = db.prepare(query).all(...params) as SaleRecord[];
        const hasMore = rows.length > limit;
        const data = hasMore ? rows.slice(0, limit) : rows;

        return JSON.parse(JSON.stringify({ data, hasMore }));
    } catch (error: unknown) {
        logError("Failed to fetch paginated sale records", { error: (error as Error).message, page, search });
        return { data: [], hasMore: false };
    }
}
