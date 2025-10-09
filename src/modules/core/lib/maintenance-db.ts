/**
 * @fileoverview Server-side functions for maintenance operations (backup, restore, reset).
 * Separated to avoid circular dependencies.
 */
"use server";

import fs from 'fs';
import path from 'path';
import { DB_MODULES } from './data';
import type { UpdateBackupInfo, DatabaseModule } from '../types';
import { addLog } from './logger-db';

const dbDirectory = path.join(process.cwd(), 'dbs');
const UPDATE_BACKUP_DIR = 'update_backups';
const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);

/**
 * Creates a backup of all registered database modules for an update.
 */
export async function backupAllForUpdate(): Promise<void> {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const module of DB_MODULES) {
        const sourcePath = path.join(dbDirectory, module.dbFile);
        if (fs.existsSync(sourcePath)) {
            const backupFileName = `${module.id}_${timestamp}.db`;
            const backupPath = path.join(backupDir, backupFileName);
            fs.copyFileSync(sourcePath, backupPath);
        }
    }
}

/**
 * Restores all databases from a specific backup timestamp.
 * @param {string} timestamp - The ISO timestamp string identifying the backup set.
 */
export async function restoreAllFromUpdateBackup(timestamp: string): Promise<void> {
    const backups = await listAllUpdateBackups();
    const backupsForTimestamp = backups.filter(b => b.date === timestamp);
    
    if (backupsForTimestamp.length === 0) {
        throw new Error("No backup files found for the selected timestamp.");
    }
    
    // Use a special filename to signal a restore on next startup
    for (const backup of backupsForTimestamp) {
        const module = DB_MODULES.find(m => m.id === backup.moduleId);
        if (module) {
            const sourceBackupPath = path.join(backupDir, backup.fileName);
            const targetRestorePath = path.join(dbDirectory, `${module.dbFile}_restore.db`);
            if (fs.existsSync(sourceBackupPath)) {
                fs.copyFileSync(sourceBackupPath, targetRestorePath);
            }
        }
    }
}

/**
 * Lists all available update backups.
 * @returns {Promise<UpdateBackupInfo[]>} A list of backup information objects.
 */
export async function listAllUpdateBackups(): Promise<UpdateBackupInfo[]> {
    if (!fs.existsSync(backupDir)) {
        return [];
    }
    const files = fs.readdirSync(backupDir);
    return files
        .map(file => {
            const match = file.match(/^(.+?)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.db$/);
            if (match) {
                const [, moduleId, timestamp] = match;
                const module = DB_MODULES.find(m => m.id === moduleId);
                return {
                    moduleId: moduleId,
                    moduleName: module?.name || moduleId,
                    fileName: file,
                    date: new Date(timestamp.replace(/-/g, ':').replace('T', ' ')).toISOString(),
                };
            }
            return null;
        })
        .filter((b): b is UpdateBackupInfo => b !== null)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Deletes all backup sets except for the most recent one.
 * @returns {Promise<number>} The number of backup sets deleted.
 */
export async function deleteOldUpdateBackups(): Promise<number> {
    const backups = await listAllUpdateBackups();
    const uniqueTimestamps = [...new Set(backups.map(b => b.date))].sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
    
    if (uniqueTimestamps.length <= 1) return 0;

    const timestampsToDelete = uniqueTimestamps.slice(1);
    let deletedSets = 0;
    
    for (const ts of timestampsToDelete) {
        const filesToDelete = backups.filter(b => b.date === ts);
        for (const fileInfo of filesToDelete) {
            fs.unlinkSync(path.join(backupDir, fileInfo.fileName));
        }
        deletedSets++;
    }
    return deletedSets;
}

/**
 * Handles the server-side logic for uploading backup files.
 * @param {FormData} formData - The form data containing the files.
 * @returns {Promise<number>} The number of files successfully uploaded.
 */
export async function uploadBackupFile(formData: FormData): Promise<number> {
    const files = formData.getAll('backupFiles') as File[];
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    let uploadedCount = 0;
    for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(backupDir, file.name), buffer);
        uploadedCount++;
    }
    return uploadedCount;
}

/**
 * Resets one or all databases to their initial state by deleting the DB files.
 * The system will re-initialize them on next startup.
 * @param {string} moduleId - The ID of the module to reset, or '__all__' for a full factory reset.
 */
export async function factoryReset(moduleId: string): Promise<void> {
    if (moduleId === '__all__') {
        for (const module of DB_MODULES) {
            const dbPath = path.join(dbDirectory, module.dbFile);
            if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        }
    } else {
        const module = DB_MODULES.find(m => m.id === moduleId);
        if (module) {
            const dbPath = path.join(dbDirectory, module.dbFile);
            if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        } else {
            throw new Error("Módulo no encontrado para el reseteo.");
        }
    }
}

/**
 * Retrieves the list of configurable database modules.
 * @returns {Promise<Omit<DatabaseModule, 'initFn' | 'migrationFn'>[]>}
 */
export async function getDbModules(): Promise<Omit<DatabaseModule, 'initFn' | 'migrationFn'>[]> {
    return DB_MODULES.map(({ id, name, dbFile }) => ({ id, name, dbFile }));
}
