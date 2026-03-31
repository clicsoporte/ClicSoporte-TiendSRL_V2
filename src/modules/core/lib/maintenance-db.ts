/**
 * @fileoverview Server-side functions for maintenance operations (backup, restore, reset).
 * Simplified for single database architecture.
 */
"use server";

import fs from 'fs';
import path from 'path';
import type { UpdateBackupInfo } from '../types';
import { triggerNotificationEvent } from '@/modules/notifications/lib/notifications-engine';

const dbDirectory = path.join(process.cwd(), 'dbs');
const DB_FILE = 'intratool.db';
const UPDATE_BACKUP_DIR = 'update_backups';
const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);

/**
 * Creates a backup of the central database.
 */
export async function backupAllForUpdate(): Promise<void> {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sourcePath = path.join(dbDirectory, DB_FILE);
    
    if (fs.existsSync(sourcePath)) {
        const backupFileName = `clic-tools-main_${timestamp}.db`;
        const backupPath = path.join(backupDir, backupFileName);
        fs.copyFileSync(sourcePath, backupPath);
    }

    await triggerNotificationEvent('onBackupCompleted', { timestamp: new Date().toLocaleString() });
}

/**
 * Restores the database from a specific backup timestamp.
 */
export async function restoreAllFromUpdateBackup(timestamp: string): Promise<void> {
    const backups = await listAllUpdateBackups();
    const backup = backups.find(b => b.date === timestamp);
    
    if (!backup) {
        throw new Error("No backup files found for the selected timestamp.");
    }
    
    const sourceBackupPath = path.join(backupDir, backup.fileName);
    const targetRestorePath = path.join(dbDirectory, `${DB_FILE}_restore.db`);
    
    if (fs.existsSync(sourceBackupPath)) {
        fs.copyFileSync(sourceBackupPath, targetRestorePath);
    }
}

/**
 * Lists all available update backups.
 */
export async function listAllUpdateBackups(): Promise<UpdateBackupInfo[]> {
    if (!fs.existsSync(backupDir)) return [];
    
    const files = fs.readdirSync(backupDir);
    return files
        .map(file => {
            const match = file.match(/^clic-tools-main_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.db$/);
            if (match) {
                const [, timestamp] = match;
                return {
                    moduleId: 'clic-tools-main',
                    moduleName: 'Clic-Tools (Sistema Principal)',
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
 * Deletes old backups.
 */
export async function deleteOldUpdateBackups(): Promise<number> {
    const backups = await listAllUpdateBackups();
    if (backups.length <= 1) return 0;

    const toDelete = backups.slice(1);
    for (const b of toDelete) {
        fs.unlinkSync(path.join(backupDir, b.fileName));
    }
    return toDelete.length;
}

export async function uploadBackupFile(formData: FormData): Promise<number> {
    const files = formData.getAll('backupFiles') as File[];
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    let uploadedCount = 0;
    for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(backupDir, file.name), buffer);
        uploadedCount++;
    }
    return uploadedCount;
}

export async function factoryReset(_moduleId: string): Promise<void> {
    const dbPath = path.join(dbDirectory, DB_FILE);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

export async function getDbModules() {
    return [{ id: 'clic-tools-main', name: 'Clic-Tools (Base de Datos Unificada)', dbFile: DB_FILE }];
}
