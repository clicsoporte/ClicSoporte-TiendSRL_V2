/**
 * @fileoverview Server-side functions for the planner database.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from '@/modules/core/lib/db-connection';
import type { ProductionOrder, PlannerSettings, UpdateStatusPayload, UpdateOrderDetailsPayload, ProductionOrderHistoryEntry, CustomStatus, AdministrativeActionPayload, UpdateProductionOrderPayload } from '../../core/types';

const PLANNER_DB_FILE = 'planner.db';

export async function connectPlannerDb(): Promise<Database> {
    return baseConnectDb(PLANNER_DB_FILE, initializePlannerDb, runPlannerMigrations);
}

export async function initializePlannerDb(db: Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS planner_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS production_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            purchaseOrder TEXT,
            requestDate TEXT NOT NULL,
            deliveryDate TEXT NOT NULL,
            scheduledStartDate TEXT,
            scheduledEndDate TEXT,
            customerId TEXT NOT NULL,
            customerName TEXT NOT NULL,
            customerTaxId TEXT,
            productId TEXT NOT NULL,
            productDescription TEXT NOT NULL,
            quantity REAL NOT NULL,
            inventory REAL,
            inventoryErp REAL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL,
            pendingAction TEXT DEFAULT 'none',
            notes TEXT,
            requestedBy TEXT NOT NULL,
            approvedBy TEXT,
            lastStatusUpdateBy TEXT,
            lastStatusUpdateNotes TEXT,
            lastModifiedBy TEXT,
            lastModifiedAt TEXT,
            hasBeenModified BOOLEAN DEFAULT FALSE,
            deliveredQuantity REAL,
            erpPackageNumber TEXT,
            erpTicketNumber TEXT,
            reopened BOOLEAN DEFAULT FALSE,
            assignmentId TEXT,
            previousStatus TEXT
        );
         CREATE TABLE IF NOT EXISTS production_order_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderId INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            updatedBy TEXT NOT NULL,
            FOREIGN KEY (orderId) REFERENCES production_orders(id)
        );
    `;
    db.exec(schema);

    const defaultCustomStatuses: CustomStatus[] = [
        { id: 'custom-1', label: '', color: '#8884d8', isActive: false },
        { id: 'custom-2', label: '', color: '#82ca9d', isActive: false },
        { id: 'custom-3', label: '', color: '#ffc658', isActive: false },
        { id: 'custom-4', label: '', color: '#ff8042', isActive: false },
    ];

    const defaultPdfColumns = ['consecutive', 'customerName', 'productDescription', 'quantity', 'deliveryDate', 'status'];

    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('orderPrefix', 'OP-')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('nextOrderNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('showCustomerTaxId', 'true')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('assignments', '[]')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('requireAssignmentForStart', 'false')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('assignmentLabel', 'Asignado a')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('customStatuses', ?)`).run(JSON.stringify(defaultCustomStatuses));
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('pdfPaperSize', 'letter')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('pdfOrientation', 'portrait')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('pdfExportColumns', ?)`).run(JSON.stringify(defaultPdfColumns));
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('pdfTopLegend', '')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('fieldsToTrackChanges', '[]')`).run();
}

export async function runPlannerMigrations(db: Database) {
    const plannerTableInfo = db.prepare(`PRAGMA table_info(production_orders)`).all() as { name: string }[];
    const plannerColumns = new Set(plannerTableInfo.map(c => c.name));
    
    if (plannerColumns.has('machineId')) {
        db.exec('ALTER TABLE production_orders RENAME COLUMN machineId TO assignmentId');
    }
    if (!plannerColumns.has('assignmentId')) db.exec(`ALTER TABLE production_orders ADD COLUMN assignmentId TEXT`);
    if (!plannerColumns.has('deliveredQuantity')) db.exec(`ALTER TABLE production_orders ADD COLUMN deliveredQuantity REAL`);
    if (!plannerColumns.has('purchaseOrder')) db.exec(`ALTER TABLE production_orders ADD COLUMN purchaseOrder TEXT`);
    if (!plannerColumns.has('scheduledStartDate')) db.exec(`ALTER TABLE production_orders ADD COLUMN scheduledStartDate TEXT`);
    if (!plannerColumns.has('scheduledEndDate')) db.exec(`ALTER TABLE production_orders ADD COLUMN scheduledEndDate TEXT`);
    if (!plannerColumns.has('lastModifiedBy')) db.exec(`ALTER TABLE production_orders ADD COLUMN lastModifiedBy TEXT`);
    if (!plannerColumns.has('lastModifiedAt')) db.exec(`ALTER TABLE production_orders ADD COLUMN lastModifiedAt TEXT`);
    if (!plannerColumns.has('hasBeenModified')) db.exec(`ALTER TABLE production_orders ADD COLUMN hasBeenModified BOOLEAN DEFAULT FALSE`);
    if (!plannerColumns.has('previousStatus')) db.exec(`ALTER TABLE production_orders ADD COLUMN previousStatus TEXT`);
    if (!plannerColumns.has('pendingAction')) db.exec(`ALTER TABLE production_orders ADD COLUMN pendingAction TEXT DEFAULT 'none'`);
    if (!plannerColumns.has('inventoryErp')) db.exec(`ALTER TABLE production_orders ADD COLUMN inventoryErp REAL`);
    if (!plannerColumns.has('customerTaxId')) db.exec(`ALTER TABLE production_orders ADD COLUMN customerTaxId TEXT`);
}

export async function getSettings(): Promise<PlannerSettings> {
    const db = await connectPlannerDb();
    const settingsRows = db.prepare('SELECT * FROM planner_settings').all() as { key: string; value: string }[];
    
    const settings: PlannerSettings = {
        orderPrefix: 'OP-',
        nextOrderNumber: 1,
        showCustomerTaxId: true,
        assignments: [],
        requireAssignmentForStart: false,
        assignmentLabel: 'Asignado a',
        customStatuses: [],
        pdfPaperSize: 'letter',
        pdfOrientation: 'portrait',
        pdfExportColumns: [],
        pdfTopLegend: '',
        fieldsToTrackChanges: [],
    };

    for (const row of settingsRows) {
        if (row.key === 'nextOrderNumber') settings.nextOrderNumber = Number(row.value);
        else if (row.key === 'orderPrefix') settings.orderPrefix = row.value;
        else if (row.key === 'showCustomerTaxId') settings.showCustomerTaxId = row.value === 'true';
        else if (row.key === 'assignments') settings.assignments = JSON.parse(row.value);
        else if (row.key === 'requireAssignmentForStart') settings.requireAssignmentForStart = row.value === 'true';
        else if (row.key === 'assignmentLabel') settings.assignmentLabel = row.value;
        else if (row.key === 'customStatuses') settings.customStatuses = JSON.parse(row.value);
        else if (row.key === 'pdfPaperSize') settings.pdfPaperSize = row.value as 'letter' | 'legal';
        else if (row.key === 'pdfOrientation') settings.pdfOrientation = row.value as 'portrait' | 'landscape';
        else if (row.key === 'pdfExportColumns') settings.pdfExportColumns = JSON.parse(row.value);
        else if (row.key === 'pdfTopLegend') settings.pdfTopLegend = row.value;
        else if (row.key === 'fieldsToTrackChanges') settings.fieldsToTrackChanges = JSON.parse(row.value);
    }
    return JSON.parse(JSON.stringify(settings));
}

export async function saveSettings(settings: PlannerSettings): Promise<void> {
    const db = await connectPlannerDb();
    
    const transaction = db.transaction((settingsToUpdate: PlannerSettings) => {
        const keys: (keyof PlannerSettings)[] = ['orderPrefix', 'nextOrderNumber', 'showCustomerTaxId', 'assignments', 'requireAssignmentForStart', 'assignmentLabel', 'customStatuses', 'pdfPaperSize', 'pdfOrientation', 'pdfExportColumns', 'pdfTopLegend', 'fieldsToTrackChanges'];
        for (const key of keys) {
            if (settingsToUpdate[key] !== undefined) {
                const value = typeof settingsToUpdate[key] === 'object' ? JSON.stringify(settingsToUpdate[key]) : String(settingsToUpdate[key]);
                db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)').run(key, value);
            }
        }
    });

    transaction(settings);
}

export async function getOrders(options: { 
    page?: number; 
    pageSize?: number;
}): Promise<{ activeOrders: ProductionOrder[], archivedOrders: ProductionOrder[], totalArchivedCount: number }> {
    const db = await connectPlannerDb();
    
    const { page = 0, pageSize = 50 } = options;
    const archivedStatuses = `'completed', 'canceled'`;

    const activeOrders: ProductionOrder[] = db.prepare(`
        SELECT * FROM production_orders 
        WHERE status NOT IN (${archivedStatuses}) 
        ORDER BY requestDate DESC
    `).all() as ProductionOrder[];
    
    const archivedOrders: ProductionOrder[] = db.prepare(`
        SELECT * FROM production_orders 
        WHERE status IN (${archivedStatuses}) 
        ORDER BY requestDate DESC 
        LIMIT ? OFFSET ?
    `).all(pageSize, page * pageSize) as ProductionOrder[];
        
    const totalArchivedCount = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM production_orders 
        WHERE status IN (${archivedStatuses})
    `).get() as { count: number }).count;

    return { activeOrders: JSON.parse(JSON.stringify(activeOrders)), archivedOrders: JSON.parse(JSON.stringify(archivedOrders)), totalArchivedCount };
}

export async function addOrder(order: Omit<ProductionOrder, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'erpPackageNumber' | 'erpTicketNumber' | 'assignmentId' | 'previousStatus' | 'scheduledStartDate' | 'scheduledEndDate' | 'requestedBy' | 'hasBeenModified' | 'lastModifiedBy' | 'lastModifiedAt'| 'lastStatusUpdateBy' | 'lastStatusUpdateNotes' | 'approvedBy'>, requestedBy: string): Promise<ProductionOrder> {
    const db = await connectPlannerDb();
    const settings = await getSettings();
    const nextNumber = settings.nextOrderNumber || 1;
    const prefix = settings.orderPrefix || 'OP-';

    const newOrder: Omit<ProductionOrder, 'id'> = {
        ...order,
        requestedBy: requestedBy,
        consecutive: `${prefix}${nextNumber.toString().padStart(5, '0')}`,
        requestDate: new Date().toISOString(),
        status: 'pending',
        pendingAction: 'none',
        reopened: false,
        assignmentId: null,
        previousStatus: null,
        scheduledStartDate: null,
        scheduledEndDate: null,
        hasBeenModified: false,
    };

    const stmt = db.prepare(`
        INSERT INTO production_orders (
            consecutive, purchaseOrder, requestDate, deliveryDate, scheduledStartDate, scheduledEndDate,
            customerId, customerName, customerTaxId, productId, productDescription, quantity, inventory, inventoryErp, priority,
            status, pendingAction, notes, requestedBy, reopened, assignmentId, previousStatus, hasBeenModified
        ) VALUES (
            @consecutive, @purchaseOrder, @requestDate, @deliveryDate, @scheduledStartDate, @scheduledEndDate,
            @customerId, @customerName, @customerTaxId, @productId, @productDescription, @quantity, @inventory, @inventoryErp, @priority,
            @status, @pendingAction, @notes, @requestedBy, @reopened, @assignmentId, @previousStatus, @hasBeenModified
        )
    `);

    const info = stmt.run({
        ...newOrder,
        purchaseOrder: newOrder.purchaseOrder || null,
        inventory: newOrder.inventory ?? null,
        inventoryErp: newOrder.inventoryErp ?? null,
        notes: newOrder.notes || null,
        reopened: newOrder.reopened ? 1 : 0,
        hasBeenModified: newOrder.hasBeenModified ? 1 : 0,
    });
    
    const newOrderId = info.lastInsertRowid as number;
    await saveSettings({ ...settings, nextOrderNumber: nextNumber + 1 });
    
    db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)')
      .run(newOrderId, new Date().toISOString(), 'pending', newOrder.requestedBy, 'Orden creada');

    return db.prepare('SELECT * FROM production_orders WHERE id = ?').get(newOrderId) as ProductionOrder;
}

export async function updateOrder(payload: UpdateProductionOrderPayload): Promise<ProductionOrder> {
    const db = await connectPlannerDb();
    const { orderId, updatedBy, ...dataToUpdate } = payload;
    
    const currentOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder | undefined;
    if (!currentOrder) throw new Error("Order not found.");

    const settings = await getSettings();
    const fieldsToTrack = settings.fieldsToTrackChanges || [];
    let hasBeenModified = currentOrder.hasBeenModified;
    const changes: string[] = [];
    
    if (currentOrder.status !== 'pending') {
        Object.keys(dataToUpdate).forEach(field => {
            if (fieldsToTrack.includes(field)) {
                const newVal = (dataToUpdate as Record<string, unknown>)[field];
                const oldVal = (currentOrder as Record<string, unknown>)[field];
                if (newVal !== undefined && String(oldVal || '') !== String(newVal || '')) {
                    changes.push(`${field}: de '${oldVal || 'N/A'}' a '${newVal || 'N/A'}'`);
                    hasBeenModified = true;
                }
            }
        });
    }

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE production_orders SET
                deliveryDate = @deliveryDate,
                customerId = @customerId,
                customerName = @customerName,
                productId = @productId,
                productDescription = @productDescription,
                quantity = @quantity,
                inventory = @inventory,
                notes = @notes,
                purchaseOrder = @purchaseOrder,
                lastModifiedBy = @updatedBy,
                lastModifiedAt = @lastModifiedAt,
                hasBeenModified = @hasBeenModified
            WHERE id = @orderId
        `).run({ 
            ...dataToUpdate,
            orderId, 
            updatedBy, 
            lastModifiedAt: new Date().toISOString(), 
            hasBeenModified: hasBeenModified ? 1 : 0 
        });

        if (changes.length > 0) {
            db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)')
              .run(orderId, new Date().toISOString(), currentOrder.status, updatedBy, `Orden editada. ${changes.join('. ')}`);
        }
    });

    transaction();
    return db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder;
}

export async function updateStatus(payload: UpdateStatusPayload): Promise<ProductionOrder> {
    const db = await connectPlannerDb();
    const { orderId, status, notes, updatedBy, deliveredQuantity, reopen } = payload;

    const currentOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder | undefined;
    if (!currentOrder) throw new Error("Order not found.");
    
    const approvedBy = (status === 'approved' && !currentOrder.approvedBy) ? updatedBy : currentOrder.approvedBy;
    
    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE production_orders SET
                status = @status,
                lastStatusUpdateNotes = @notes,
                lastStatusUpdateBy = @updatedBy,
                approvedBy = @approvedBy,
                deliveredQuantity = @deliveredQuantity,
                reopened = @reopened,
                pendingAction = 'none',
                previousStatus = NULL
            WHERE id = @orderId
        `).run({
            status,
            notes: notes || null,
            updatedBy,
            approvedBy,
            orderId,
            deliveredQuantity: deliveredQuantity !== undefined ? deliveredQuantity : currentOrder.deliveredQuantity,
            reopened: reopen ? 1 : (currentOrder.reopened ? 1 : 0),
        });
        
        db.prepare('INSERT INTO ticket_threads (ticketId, userId, userName, type, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
          .run(orderId, 0, updatedBy, 'status_change', notes, new Date().toISOString());
    });

    transaction();
    return db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder;
}

export async function updateDetails(payload: UpdateOrderDetailsPayload): Promise<ProductionOrder> {
    const db = await connectPlannerDb();
    const { orderId, priority, assignmentId, scheduledDateRange, updatedBy } = payload;
    
    const currentOrder = db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder | undefined;
    if (!currentOrder) throw new Error("Order not found.");

    let query = 'UPDATE production_orders SET';
    const params: Record<string, string | number | null> = { orderId };
    const updates: string[] = [];
    const historyItems: string[] = [];

    if (priority && currentOrder.priority !== priority) {
        updates.push('priority = @priority');
        params.priority = priority;
        historyItems.push(`Prioridad: de ${currentOrder.priority} a ${priority}`);
    }
    if (assignmentId !== undefined && currentOrder.assignmentId !== assignmentId) {
        updates.push('assignmentId = @assignmentId');
        params.assignmentId = assignmentId;
        historyItems.push(`Asignación actualizada`);
    }
     if (scheduledDateRange) {
        const newStartDate = scheduledDateRange.from ? scheduledDateRange.from.toISOString().split('T')[0] : null;
        const newEndDate = scheduledDateRange.to ? scheduledDateRange.to.toISOString().split('T')[0] : null;
        updates.push('scheduledStartDate = @scheduledStartDate', 'scheduledEndDate = @scheduledEndDate');
        params.scheduledStartDate = newStartDate;
        params.scheduledEndDate = newEndDate;
        historyItems.push(`Programación actualizada`);
    }
    
    if (updates.length > 0) {
        query += ` ${updates.join(', ')} WHERE id = @orderId`;
        const transaction = db.transaction(() => {
            db.prepare(query).run(params);
            db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)')
              .run(orderId, new Date().toISOString(), currentOrder.status, updatedBy, `Detalles actualizados: ${historyItems.join('. ')}`);
        });
        transaction();
    }

    return db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder;
}

export async function getOrderHistory(orderId: number): Promise<ProductionOrderHistoryEntry[]> {
    const db = await connectPlannerDb();
    return db.prepare('SELECT * FROM production_order_history WHERE orderId = ? ORDER BY timestamp DESC').all(orderId) as ProductionOrderHistoryEntry[];
}

export async function addNote(payload: { orderId: number; notes: string; updatedBy: string; }): Promise<ProductionOrder> {
    const db = await connectPlannerDb();
    const { orderId, notes, updatedBy } = payload;
    const currentOrder = db.prepare('SELECT status FROM production_orders WHERE id = ?').get(orderId) as { status: string };

    const transaction = db.transaction(() => {
        db.prepare('UPDATE production_orders SET lastStatusUpdateNotes = ?, lastStatusUpdateBy = ? WHERE id = ?')
          .run(notes, updatedBy, orderId);
        db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)')
          .run(orderId, new Date().toISOString(), currentOrder.status, updatedBy, `Nota agregada: ${notes}`);
    });

    transaction();
    return db.prepare('SELECT * FROM production_orders WHERE id = ?').get(orderId) as ProductionOrder;
}

export async function updatePendingAction(payload: AdministrativeActionPayload): Promise<ProductionOrder> {
    const db = await connectPlannerDb();
    const { entityId, action, updatedBy } = payload;
    const currentOrder = db.prepare('SELECT status FROM production_orders WHERE id = ?').get(entityId) as { status: string };

    const transaction = db.transaction(() => {
        db.prepare(`UPDATE production_orders SET pendingAction = @action WHERE id = @entityId`).run({ action, entityId });
        db.prepare('INSERT INTO production_order_history (orderId, timestamp, status, updatedBy, notes) VALUES (?, ?, ?, ?, ?)')
          .run(entityId, new Date().toISOString(), currentOrder.status, updatedBy, `Acción administrativa '${action}' solicitada`);
    });
    
    transaction();
    return db.prepare('SELECT * FROM production_orders WHERE id = ?').get(entityId) as ProductionOrder;
}
