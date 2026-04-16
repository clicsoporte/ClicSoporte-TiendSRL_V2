/**
 * @fileoverview Server Actions for the Inventory & Warranty module.
 * Implements high-performance search and CRUD for a 1GB RAM environment.
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
                SELECT * FROM inventory_equipment WHERE serialNumber = ? LIMIT 1
            `).get(query.trim()) as Equipment | undefined;

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
            SELECT 'equipment' as type, id, nickname as mainLabel, brand || ' ' || model as subLabel, serialNumber, clientId
            FROM inventory_equipment 
            WHERE nickname LIKE ? OR brand LIKE ? OR model LIKE ? OR serialNumber LIKE ? OR assignedUser LIKE ?
            UNION ALL
            SELECT 'warranty' as type, id, productName as mainLabel, invoiceNumber as subLabel, serialNumber, clientId
            FROM inventory_sale_records
            WHERE invoiceNumber LIKE ? OR serialNumber LIKE ? OR productName LIKE ?
            LIMIT ? OFFSET ?
        `).all(
            cleanQuery, cleanQuery, cleanQuery, cleanQuery, cleanQuery,
            cleanQuery, cleanQuery, cleanQuery,
            limit + 1, offset
        ) as any[];

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

export async function saveEquipment(data: Omit<Equipment, 'createdAt' | 'updatedAt'>) {
    await authorizeAction('inventory:manage');
    const db = await connectDb();
    const now = new Date().toISOString();
    
    try {
        db.prepare(`
            INSERT INTO inventory_equipment (id, clientId, nickname, category, brand, model, serialNumber, location, assignedUser, status, notes, createdAt, updatedAt)
            VALUES (@id, @clientId, @nickname, @category, @brand, @model, @serialNumber, @location, @assignedUser, @status, @notes, @now, @now)
            ON CONFLICT(id) DO UPDATE SET
                clientId=@clientId, nickname=@nickname, category=@category, brand=@brand, model=@model, 
                serialNumber=@serialNumber, location=@location, assignedUser=@assignedUser, 
                status=@status, notes=@notes, updatedAt=@now
        `).run({ ...data, now });

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
        `).run({ ...data, now });

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
    `).run({ ...data, isRecurring: data.isRecurring ? 1 : 0, now });
    
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

export async function getAllSaleRecords(): Promise<SaleRecord[]> {
    await authorizeAction('inventory:warranty:hub');
    const db = await connectDb();
    const rows = db.prepare('SELECT * FROM inventory_sale_records ORDER BY warrantyExpiry ASC').all() as SaleRecord[];
    return JSON.parse(JSON.stringify(rows));
}
