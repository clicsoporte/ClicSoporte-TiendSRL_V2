/**
 * @fileoverview Server-side functions for the planner module.
 * Unified into intratool.db. Handles TI project tracking and materials.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb } from '@/modules/core/lib/db';
import { logError } from '@/modules/core/lib/logger';
import type { TIProject, ProjectAdvance, ProjectAttachment, ProjectItem, PlannerSettings } from '../../core/types';

export async function connectPlannerDb(): Promise<Database> {
    return connectDb();
}

/**
 * Normalizes a database row to a TIProject object.
 */
function mapProjectRow(db: Database, row: Record<string, unknown>): TIProject {
    const subcontractorIds = db.prepare('SELECT providerId FROM project_subcontractors WHERE projectId = ?').all(row.id) as { providerId: number }[];
    
    return {
        ...row,
        id: Number(row.id),
        coordinatorId: Number(row.coordinatorId),
        subcontractorId: row.subcontractorId ? Number(row.subcontractorId) : null,
        subcontractorIds: (subcontractorIds || []).map(s => Number(s.providerId))
    } as TIProject;
}

export async function getSettings(): Promise<PlannerSettings> {
    const db = await connectPlannerDb();
    const rows = db.prepare('SELECT * FROM planner_settings').all() as { key: string; value: string }[];
    const settings: Record<string, unknown> = {};
    rows.forEach(row => {
        if (row.key === 'nextProjectNumber') settings[row.key] = Number(row.value);
        else if (['assignments'].includes(row.key)) {
            try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = []; }
        } else if (['showCustomerTaxId', 'requireAssignmentForStart'].includes(row.key)) {
            settings[row.key] = row.value === 'true' || row.value === '1';
        } else { settings[row.key] = row.value; }
    });
    
    // Set defaults
    if (!settings.assignments) settings.assignments = [];
    if (settings.showCustomerTaxId === undefined) settings.showCustomerTaxId = true;
    if (!settings.assignmentLabel) settings.assignmentLabel = 'Asignado a';
    if (!settings.pdfPaperSize) settings.pdfPaperSize = 'letter';
    
    return settings as PlannerSettings;
}

export async function saveSettings(settings: Partial<PlannerSettings>): Promise<void> {
    const db = await connectPlannerDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)');
    Object.entries(settings).forEach(([key, value]) => {
        const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
        upsert.run(key, valueToStore);
    });
}

export async function getProjects(): Promise<TIProject[]> {
    const db = await connectPlannerDb();
    const rows = db.prepare('SELECT * FROM projects ORDER BY createdAt DESC').all() as Record<string, unknown>[];
    return rows.map(row => mapProjectRow(db, row));
}

export async function getProjectById(id: number): Promise<TIProject | null> {
    const db = await connectPlannerDb();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? mapProjectRow(db, row) : null;
}

export async function addProject(project: Omit<TIProject, 'id' | 'consecutive' | 'createdAt' | 'updatedAt' | 'billingStatus'>): Promise<TIProject> {
    try {
        const db = await connectPlannerDb();
        const settings = await getSettings();
        const nextNum = settings.nextProjectNumber || 1;
        const prefix = settings.projectPrefix || 'PROJ-';
        const consecutive = `${prefix}${nextNum.toString().padStart(5, '0')}`;
        const now = new Date().toISOString();

        const transaction = db.transaction(() => {
            const info = db.prepare(`
                INSERT INTO projects (consecutive, name, customerId, customerName, category, status, priority, startDate, endDate, coordinatorId, subcontractorId, description, notes, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                consecutive, 
                project.name, 
                project.customerId, 
                project.customerName, 
                project.category, 
                project.status, 
                project.priority, 
                project.startDate, 
                project.endDate, 
                Number(project.coordinatorId), 
                project.subcontractorId ? Number(project.subcontractorId) : null, 
                project.description, 
                project.notes || null, 
                now, 
                now
            );

            const projectId = Number(info.lastInsertRowid);

            // Handle subcontractors
            if (project.subcontractorIds && project.subcontractorIds.length > 0) {
                const insertSub = db.prepare('INSERT INTO project_subcontractors (projectId, providerId) VALUES (?, ?)');
                for (const subId of project.subcontractorIds) {
                    insertSub.run(projectId, Number(subId));
                }
            } else if (project.subcontractorId) {
                db.prepare('INSERT INTO project_subcontractors (projectId, providerId) VALUES (?, ?)').run(projectId, Number(project.subcontractorId));
            }

            db.prepare("UPDATE planner_settings SET value = ? WHERE key = 'nextProjectNumber'").run(String(nextNum + 1));
            
            const newRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
            return mapProjectRow(db, newRow);
        });

        return transaction();
    } catch (error: unknown) {
        const err = error as Error;
        await logError("Falla al crear proyecto TI en DB", { error: err.message, name: project.name });
        throw new Error(`Error de base de datos: ${err.message}`);
    }
}

export async function updateProject(project: TIProject): Promise<TIProject> {
    const db = await connectPlannerDb();
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE projects SET
                name = ?, category = ?, status = ?, priority = ?, startDate = ?, endDate = ?,
                coordinatorId = ?, subcontractorId = ?, description = ?, notes = ?,
                billingStatus = ?, updatedAt = ?
            WHERE id = ?
        `).run(
            project.name, 
            project.category, 
            project.status, 
            project.priority, 
            project.startDate, 
            project.endDate, 
            Number(project.coordinatorId), 
            project.subcontractorId ? Number(project.subcontractorId) : null, 
            project.description, 
            project.notes || null, 
            project.billingStatus, 
            now, 
            project.id
        );

        // Sync subcontractors
        db.prepare('DELETE FROM project_subcontractors WHERE projectId = ?').run(project.id);
        const insertSub = db.prepare('INSERT INTO project_subcontractors (projectId, providerId) VALUES (?, ?)');
        if (project.subcontractorIds) {
            for (const subId of project.subcontractorIds) {
                insertSub.run(project.id, Number(subId));
            }
        }

        const updatedRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id) as Record<string, unknown>;
        return mapProjectRow(db, updatedRow);
    });

    return transaction();
}

export async function getProjectAdvances(projectId: number): Promise<ProjectAdvance[]> {
    const db = await connectPlannerDb();
    const rows = db.prepare('SELECT * FROM project_advances WHERE projectId = ? ORDER BY timestamp ASC').all(projectId) as Record<string, unknown>[];
    return rows.map((r) => ({ 
        ...r, 
        id: Number(r.id), 
        projectId: Number(r.projectId),
        timestamp: String(r.timestamp),
        content: String(r.content),
        userId: Number(r.userId),
        userName: String(r.userName)
    })) as ProjectAdvance[];
}

export async function addProjectAdvance(advance: Omit<ProjectAdvance, 'id' | 'timestamp'>): Promise<ProjectAdvance> {
    const db = await connectPlannerDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO project_advances (projectId, timestamp, content, userId, userName) VALUES (?, ?, ?, ?, ?)`).run(advance.projectId, now, advance.content, advance.userId, advance.userName);
    const row = db.prepare('SELECT * FROM project_advances WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
    return {
        ...row,
        id: Number(row.id),
        projectId: Number(row.projectId),
        timestamp: String(row.timestamp),
        content: String(row.content),
        userId: Number(row.userId),
        userName: String(row.userName)
    } as ProjectAdvance;
}

export async function getProjectAttachments(projectId: number): Promise<ProjectAttachment[]> {
    const db = await connectPlannerDb();
    const rows = db.prepare('SELECT * FROM project_attachments WHERE projectId = ? ORDER BY createdAt DESC').all(projectId) as Record<string, unknown>[];
    return rows.map((r) => ({ 
        ...r, 
        id: Number(r.id), 
        projectId: Number(r.projectId),
        name: String(r.name),
        fileName: String(r.fileName),
        fileType: String(r.fileType),
        data: String(r.data),
        uploadedBy: String(r.uploadedBy),
        createdAt: String(r.createdAt)
    })) as ProjectAttachment[];
}

export async function addProjectAttachment(attachment: Omit<ProjectAttachment, 'id' | 'createdAt'>): Promise<ProjectAttachment> {
    const db = await connectPlannerDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO project_attachments (projectId, name, fileName, fileType, data, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(attachment.projectId, attachment.name, attachment.fileName, attachment.fileType, attachment.data, attachment.uploadedBy, now);
    const row = db.prepare('SELECT * FROM project_attachments WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
    return {
        ...row,
        id: Number(row.id),
        projectId: Number(row.projectId),
        name: String(row.name),
        fileName: String(row.fileName),
        fileType: String(row.fileType),
        data: String(row.data),
        uploadedBy: String(row.uploadedBy),
        createdAt: String(row.createdAt)
    } as ProjectAttachment;
}

export async function getProjectItems(projectId: number): Promise<ProjectItem[]> {
    const db = await connectPlannerDb();
    const rows = db.prepare('SELECT * FROM project_items WHERE projectId = ?').all(projectId) as Record<string, unknown>[];
    return rows.map((r) => ({ 
        ...r, 
        id: Number(r.id), 
        projectId: Number(r.projectId), 
        quantity: Number(r.quantity), 
        unitPrice: Number(r.unitPrice),
        description: String(r.description),
        type: r.type as 'material' | 'service'
    })) as ProjectItem[];
}

export async function saveProjectItem(item: Omit<ProjectItem, 'id'>): Promise<ProjectItem> {
    const db = await connectPlannerDb();
    const info = db.prepare(`INSERT INTO project_items (projectId, description, quantity, unitPrice, type) VALUES (?, ?, ?, ?, ?)`).run(item.projectId, item.description, item.quantity, item.unitPrice, item.type);
    const row = db.prepare('SELECT * FROM project_items WHERE id = ?').get(info.lastInsertRowid) as Record<string, unknown>;
    return {
        ...row,
        id: Number(row.id),
        projectId: Number(row.projectId),
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
        description: String(row.description),
        type: row.type as 'material' | 'service'
    } as ProjectItem;
}

export async function deleteProjectItem(id: number): Promise<void> {
    const db = await connectPlannerDb();
    db.prepare('DELETE FROM project_items WHERE id = ?').run(id);
}
