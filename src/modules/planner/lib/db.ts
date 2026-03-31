/**
 * @fileoverview Server-side functions for the planner module.
 * Unified into intratool.db.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb } from '@/modules/core/lib/db';
import type { TIProject, ProjectAdvance, ProjectAttachment, ProjectItem, PlannerSettings } from '../../core/types';

export async function connectPlannerDb(): Promise<Database> {
    return connectDb();
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
    if (!settings.assignments) settings.assignments = [];
    if (settings.showCustomerTaxId === undefined) settings.showCustomerTaxId = true;
    if (!settings.assignmentLabel) settings.assignmentLabel = 'Asignado a';
    return settings as unknown as PlannerSettings;
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
    return db.prepare('SELECT * FROM projects ORDER BY createdAt DESC').all() as TIProject[];
}

export async function getProjectById(id: number): Promise<TIProject | null> {
    const db = await connectPlannerDb();
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as TIProject | null;
}

export async function addProject(project: Omit<TIProject, 'id' | 'consecutive' | 'createdAt' | 'updatedAt' | 'billingStatus'>): Promise<TIProject> {
    const db = await connectPlannerDb();
    const settings = await getSettings();
    const nextNum = settings.nextProjectNumber || 1;
    const prefix = settings.projectPrefix || 'PROJ-';
    const consecutive = `${prefix}${nextNum.toString().padStart(5, '0')}`;
    const now = new Date().toISOString();

    const info = db.prepare(`
        INSERT INTO projects (consecutive, name, customerId, customerName, category, status, priority, startDate, endDate, coordinatorId, subcontractorId, description, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(consecutive, project.name, project.customerId, project.customerName, project.category, project.status, project.priority, project.startDate, project.endDate, project.coordinatorId, project.subcontractorId, project.description, project.notes, now, now);

    await saveSettings({ nextProjectNumber: nextNum + 1 });
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid) as TIProject;
}

export async function updateProject(project: TIProject): Promise<TIProject> {
    const db = await connectPlannerDb();
    const now = new Date().toISOString();
    db.prepare(`
        UPDATE projects SET
            name = ?, category = ?, status = ?, priority = ?, startDate = ?, endDate = ?,
            coordinatorId = ?, subcontractorId = ?, description = ?, notes = ?,
            billingStatus = ?, updatedAt = ?
        WHERE id = ?
    `).run(project.name, project.category, project.status, project.priority, project.startDate, project.endDate, project.coordinatorId, project.subcontractorId, project.description, project.notes, project.billingStatus, now, project.id);
    return project;
}

export async function getProjectAdvances(projectId: number): Promise<ProjectAdvance[]> {
    const db = await connectPlannerDb();
    return db.prepare('SELECT * FROM project_advances WHERE projectId = ? ORDER BY timestamp ASC').all(projectId) as ProjectAdvance[];
}

export async function addProjectAdvance(advance: Omit<ProjectAdvance, 'id' | 'timestamp'>): Promise<ProjectAdvance> {
    const db = await connectPlannerDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO project_advances (projectId, timestamp, content, userId, userName) VALUES (?, ?, ?, ?, ?)`).run(advance.projectId, now, advance.content, advance.userId, advance.userName);
    return db.prepare('SELECT * FROM project_advances WHERE id = ?').get(info.lastInsertRowid) as ProjectAdvance;
}

export async function getProjectAttachments(projectId: number): Promise<ProjectAttachment[]> {
    const db = await connectPlannerDb();
    return db.prepare('SELECT * FROM project_attachments WHERE projectId = ? ORDER BY createdAt DESC').all(projectId) as ProjectAttachment[];
}

export async function addProjectAttachment(attachment: Omit<ProjectAttachment, 'id' | 'createdAt'>): Promise<ProjectAttachment> {
    const db = await connectPlannerDb();
    const now = new Date().toISOString();
    const info = db.prepare(`INSERT INTO project_attachments (projectId, name, fileName, fileType, data, uploadedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(attachment.projectId, attachment.name, attachment.fileName, attachment.fileType, attachment.data, attachment.uploadedBy, now);
    return db.prepare('SELECT * FROM project_attachments WHERE id = ?').get(info.lastInsertRowid) as ProjectAttachment;
}

export async function getProjectItems(projectId: number): Promise<ProjectItem[]> {
    const db = await connectPlannerDb();
    return db.prepare('SELECT * FROM project_items WHERE projectId = ?').all(projectId) as ProjectItem[];
}

export async function saveProjectItem(item: Omit<ProjectItem, 'id'>): Promise<ProjectItem> {
    const db = await connectPlannerDb();
    const info = db.prepare(`INSERT INTO project_items (projectId, description, quantity, unitPrice, type) VALUES (?, ?, ?, ?, ?)`).run(item.projectId, item.description, item.quantity, item.unitPrice, item.type);
    return db.prepare('SELECT * FROM project_items WHERE id = ?').get(info.lastInsertRowid) as ProjectItem;
}

export async function deleteProjectItem(id: number): Promise<void> {
    const db = await connectPlannerDb();
    db.prepare('DELETE FROM project_items WHERE id = ?').run(id);
}
