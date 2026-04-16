/**
 * @fileoverview Server Actions for the Inventory & Warranty module.
 * Implements high-performance search and pagination for a 1GB RAM environment.
 */
'use server';

import { connectDb } from "@/modules/core/lib/db";
import { authorizeAction } from "@/modules/core/lib/auth-guard";
import type { Equipment, SaleRecord, InventorySearchResult, WarrantyStatus, Consumable } from "@/modules/core/types";
import { logError } from "@/modules/core/lib/logger";
import { revalidatePath } from "next/cache";

/**
 * Computes the real-time warranty status without storing it in the DB.
 */
export function getWarrantyStatus(expiryDateStr: string, currentStatus: string): WarrantyStatus {
    if (currentStatus === 'claimed') return 'claimed';
    if (currentStatus === 'void') return 'void';

    const expiryDate = new Date(expiryDateStr);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'active';
}

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
        // Priority 1: Check for exact Serial Number in Equipment
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

            // Priority 2: Check for exact Invoice Number in Sales
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

        // Broad Search with Pagination
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
            // Re-fetch full data based on type to ensure consistency
            if (row.type === 'equipment') {
                const data = db.prepare('SELECT * FROM inventory_equipment WHERE id = ?').get(row.id) as Equipment;
                return { type: 'equipment' as const, data };
            } else {
                const data = db.prepare('SELECT * FROM inventory_sale_records WHERE id = ?').get(row.id) as SaleRecord;
                return { type: 'warranty' as const, data };
            }
        });

        return { 
            results: finalResults, 
            hasMore, 
            totalCount: 0 // Count is expensive on broad UNION queries, omitting for RAM protection
        };

    } catch (error: unknown) {
        logError("OmniSearch failed", { error: (error as Error).message, query });
        return { results: [], hasMore: false, totalCount: 0 };
    }
}

/**
 * Gets full details for an equipment including consumables and sales.
 */
export async function getEquipmentDetails(id: string) {
    await authorizeAction('inventory:read');
    const db = await connectDb();
    
    const equipment = db.prepare('SELECT * FROM inventory_equipment WHERE id = ?').get(id) as Equipment | undefined;
    if (!equipment) return null;

    const consumables = db.prepare('SELECT * FROM inventory_consumables WHERE equipmentId = ?').all(id) as Consumable[];
    const sales = db.prepare('SELECT * FROM inventory_sale_records WHERE equipmentId = ? OR serialNumber = ?').all(id, equipment.serialNumber) as SaleRecord[];

    return {
        ...equipment,
        consumables,
        saleRecords: sales
    };
}

/**
 * Registers a warranty claim.
 */
export async function claimWarranty(saleId: string, notes: string) {
    await authorizeAction('inventory:manage');
    const db = await connectDb();
    const now = new Date().toISOString();
    
    db.prepare(`
        UPDATE inventory_sale_records 
        SET warrantyStatus = 'claimed', claimDate = ?, claimNotes = ?, updatedAt = ?
        WHERE id = ?
    `).run(now, notes, now, saleId);
    
    revalidatePath('/dashboard/inventory');
    return { success: true };
}

/**
 * Retrieves all sale records for the Warranty Hub.
 */
export async function getAllSaleRecords(): Promise<SaleRecord[]> {
    await authorizeAction('inventory:warranty:hub');
    const db = await connectDb();
    const rows = db.prepare('SELECT * FROM inventory_sale_records ORDER BY warrantyExpiry ASC').all() as SaleRecord[];
    return JSON.parse(JSON.stringify(rows));
}
