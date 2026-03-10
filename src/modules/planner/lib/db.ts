/**
 * @fileoverview Server-side functions for the TI project manager database.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from '@/modules/core/lib/db-connection';
import type { TIProject, ProjectAdvance, ProjectAttachment, ProjectItem, PlannerSettings } from '../../core/types';

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
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            customerId TEXT NOT NULL,
            customerName TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'other', -- alarms, wireless, pos, fencing, cctv, etc.
            status TEXT NOT NULL, -- planning, execution, testing, completed, canceled
            priority TEXT NOT NULL, -- low, medium, high, urgent
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            coordinatorId INTEGER NOT NULL,
            subcontractorId INTEGER,
            description TEXT NOT NULL,
            notes TEXT,
            billingStatus TEXT DEFAULT 'pending', -- pending, invoiced
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS project_advances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projectId INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            content TEXT NOT NULL,
            userId INTEGER NOT NULL,
            userName TEXT NOT NULL,
            FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS project_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projectId INTEGER NOT NULL,
            name TEXT NOT NULL,
            fileName TEXT NOT NULL,
            fileType TEXT NOT NULL,
            data TEXT NOT NULL, -- Base64
            uploadedBy TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS project_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projectId INTEGER NOT NULL,
            description TEXT NOT NULL,
            quantity REAL NOT NULL,
            unitPrice REAL NOT NULL,
            type TEXT NOT NULL, -- material, service
            FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );
    `;
    db.exec(schema);

    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('projectPrefix', 'PROJ-')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('nextProjectNumber', '1')`).run();
    db.prepare(`INSERT OR IGNORE INTO planner_settings (key, value) VALUES ('pdfTopLegend', 'ACTA DE ENTREGA DE PROYECTO TI')`).run();
}

export async function runPlannerMigrations(db: Database) {
    const tableInfo = db.prepare(`PRAGMA table_info(projects)`).all() as { name: string }[];
    const columns = new Set(tableInfo.map(c => c.name));
    
    if (!columns.has('category')) {
        console.log("MIGRATION (planner.db): Adding 'category' column to 'projects' table.");
        db.exec(`ALTER TABLE projects ADD COLUMN category TEXT NOT NULL DEFAULT 'other';`);
    }
}

export async function getSettings(): Promise<PlannerSettings> {
    const db = await connectPlannerDb();
    const rows = db.prepare('SELECT * FROM planner_settings').all() as { key: string; value: string }[];
    const settings: any = {};
    rows.forEach(row => {
        if (row.key === 'nextProjectNumber') settings.nextProjectNumber = Number(row.value);
        else settings[row.key] = row.value;
    });
    return settings as PlannerSettings;
}

export async function saveSettings(settings: Partial<PlannerSettings>): Promise<void> {
    const db = await connectPlannerDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO planner_settings (key, value) VALUES (?, ?)');
    Object.entries(settings).forEach(([key, value]) => {
        upsert.run(key, String(value));
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
    const consecutive = `${settings.projectPrefix || 'PROJ-'}${nextNum.toString().padStart(5, '0')}`;
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
