/**
 * @fileoverview Server-side functions for maintenance operations (backup, restore, reset).
 * Simplified for single database architecture. Refactored for production robustness.
 * Includes cryptographic keys in the backup process.
 */
"use server";

import fs from 'fs';
import path from 'path';
import type { UpdateBackupInfo } from '../types';
import { triggerNotificationEvent } from '@/modules/notifications/lib/notifications-engine';

const dbDirectory = path.join(process.cwd(), 'dbs');
const DB_FILE = 'intratool.db';
const KEYS_DIR = path.join(dbDirectory, 'keys');
const UPDATE_BACKUP_DIR = 'update_backups';
const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);

/**
 * Creates a backup of the central database and cryptographic keys.
 */
export async function backupAllForUpdate(): Promise<void> {
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sourcePath = path.join(dbDirectory, DB_FILE);
    
    // 1. Backup Main Database
    if (fs.existsSync(sourcePath)) {
        const backupFileName = `clic-tools-main_${timestamp}.db`;
        const backupPath = path.join(backupDir, backupFileName);
        fs.copyFileSync(sourcePath, backupPath);
    }

    // 2. Backup RSA Keys (Critical for license validation after restore)
    if (fs.existsSync(KEYS_DIR)) {
        const keysBackupDir = path.join(backupDir, `keys_${timestamp}`);
        fs.mkdirSync(keysBackupDir, { recursive: true });
        const keyFiles = fs.readdirSync(KEYS_DIR);
        for (const file of keyFiles) {
            fs.copyFileSync(path.join(KEYS_DIR, file), path.join(keysBackupDir, file));
        }
    }

    await triggerNotificationEvent('onBackupCompleted', { timestamp: new Date().toLocaleString() });
}

/**
 * Restores the database from a specific backup timestamp.
 * Also restores the corresponding cryptographic keys.
 */
export async function restoreAllFromUpdateBackup(timestamp: string): Promise<void> {
    const backups = await listAllUpdateBackups();
    const backup = backups.find(b => b.date === timestamp);
    
    if (!backup) {
        throw new Error("No backup files found for the selected timestamp.");
    }

    // Clean timestamp for file matching (removes ISO extra bits to match backup folder naming)
    const folderTimestamp = backup.date.replace(/[:.]/g, '-');
    
    const sourceBackupPath = path.join(backupDir, backup.fileName);
    const targetRestorePath = path.join(dbDirectory, `${DB_FILE}_restore.db`);
    
    // 1. Restore Database
    if (fs.existsSync(sourceBackupPath)) {
        fs.copyFileSync(sourceBackupPath, targetRestorePath);
    }

    // 2. Restore Keys
    const keysBackupDir = path.join(backupDir, `keys_${folderTimestamp}`);
    if (fs.existsSync(keysBackupDir)) {
        if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });
        const keyFiles = fs.readdirSync(keysBackupDir);
        for (const file of keyFiles) {
            fs.copyFileSync(path.join(keysBackupDir, file), path.join(KEYS_DIR, file));
        }
    }
}

/**
 * Lists all available update backups with robust date parsing.
 */
export async function listAllUpdateBackups(): Promise<UpdateBackupInfo[]> {
    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
            return [];
        }
        
        const files = fs.readdirSync(backupDir);
        const backups = files
            .map(file => {
                const match = file.match(/^clic-tools-main_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.db$/);
                if (match) {
                    const [, timestamp] = match;
                    // Robust conversion: 2024-05-25T12-33-58-123Z -> 2024-05-25T12:33:58.123Z
                    const isoDateString = timestamp.replace(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, '$1T$2:$3:$4.$5Z');
                    
                    try {
                        const dateObj = new Date(isoDateString);
                        if (isNaN(dateObj.getTime())) return null;

                        return {
                            moduleId: 'clic-tools-main',
                            moduleName: 'Clic-Tools (Sistema Principal)',
                            fileName: file,
                            date: dateObj.toISOString(),
                        };
                    } catch {
                        return null;
                    }
                }
                return null;
            })
            .filter((b): b is UpdateBackupInfo => b !== null)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return JSON.parse(JSON.stringify(backups));
    } catch (error) {
        console.error("Critical error listing backups:", error);
        return [];
    }
}

/**
 * Deletes old backups.
 */
export async function deleteOldUpdateBackups(): Promise<number> {
    const backups = await listAllUpdateBackups();
    if (backups.length <= 1) return 0;

    const toDelete = backups.slice(1);
    let deletedCount = 0;
    for (const b of toDelete) {
        const filePath = path.join(backupDir, b.fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedCount++;
        }
        // Also delete key folder if exists
        const folderTimestamp = b.date.replace(/[:.]/g, '-');
        const keysBackupDir = path.join(backupDir, `keys_${folderTimestamp}`);
        if (fs.existsSync(keysBackupDir)) {
            fs.rmSync(keysBackupDir, { recursive: true, force: true });
        }
    }
    return deletedCount;
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

/**
 * Performs a factory reset by unlinking the main database file.
 */
export async function factoryReset(): Promise<void> {
    const dbPath = path.join(dbDirectory, DB_FILE);
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

export async function getDbModules() {
    return JSON.parse(JSON.stringify([{ id: 'clic-tools-main', name: 'Clic-Tools (Base de Datos Unificada)', dbFile: DB_FILE }]));
}
