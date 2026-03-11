
'use server';

/**
 * @fileoverview Scheduler service for executing background tasks.
 * Uses node-cron to manage the execution of tasks defined in notifications.db.
 */

import cron from 'node-cron';
import { getAllScheduledTasks } from './db';
import { importAllDataFromFiles } from '@/modules/core/lib/import-service';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { triggerNotificationEvent } from './notifications-engine';
import { connectDb } from '@/modules/core/lib/db';
import { backupAllForUpdate } from '@/modules/core/lib/maintenance-db';
import type { Contract, License } from '@/modules/core/types';
import { differenceInDays, parseISO } from 'date-fns';

let runningJobs: Map<number, cron.ScheduledTask> = new Map();

/**
 * Task: Full ERP Synchronization.
 * Fetches latest data from the ERP if configured.
 */
async function executeErpSync() {
    try {
        await logInfo('Auto-Sincronización ERP iniciada por tarea programada.');
        const results = await importAllDataFromFiles();
        await logInfo('Auto-Sincronización ERP completada exitosamente.', { results });
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Auto-Sincronización ERP falló.', { error: err.message });
    }
}

/**
 * Task: System Backup.
 * Creates a restore point for all databases.
 */
async function executeBackup() {
    try {
        await logInfo('Copia de seguridad programada iniciada.');
        await backupAllForUpdate();
        await logInfo('Copia de seguridad programada completada con éxito.');
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Copia de seguridad programada falló.', { error: err.message });
    }
}

/**
 * Task: Expiration Check.
 * Scans contracts and licenses for upcoming expiration dates.
 */
async function executeExpirationCheck() {
    try {
        const contractsDb = await connectDb('contracts.db');
        const licensesDb = await connectDb('licenses.db');
        const now = new Date();

        // 1. Check Contracts
        const contracts = contractsDb.prepare("SELECT * FROM contracts WHERE status = 'active'").all() as Contract[];
        for (const contract of contracts) {
            const daysLeft = differenceInDays(parseISO(contract.endDate), now);
            // Alert at 30, 15, and 7 days
            if ([30, 15, 7].includes(daysLeft)) {
                await triggerNotificationEvent('onContractExpiring', { ...contract, daysLeft });
            }
        }

        // 2. Check Licenses
        const licenses = licensesDb.prepare("SELECT * FROM licenses WHERE status = 'active' AND isPerpetual = 0").all() as License[];
        for (const license of licenses) {
            const daysLeft = differenceInDays(parseISO(license.expirationDate), now);
            if (daysLeft <= 7 && daysLeft >= 0) {
                await triggerNotificationEvent('onLicenseExpiring', { ...license, daysLeft });
            }
        }

        await logInfo('Vigilante de Vencimientos: Revisión diaria completada.');
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Vigilante de Vencimientos falló.', { error: err.message });
    }
}

/**
 * Catalog of available background tasks.
 */
const taskCatalog: Record<string, () => Promise<void>> = {
    'erp-sync': executeErpSync,
    'backup-system': executeBackup,
    'check-expirations': executeExpirationCheck,
};

/**
 * Initializes or re-initializes all enabled scheduled tasks.
 */
export async function initScheduler() {
    // Stop all currently running jobs
    runningJobs.forEach(job => job.stop());
    runningJobs.clear();

    const tasks = await getAllScheduledTasks();
    const enabledTasks = tasks.filter(t => t.enabled);

    for (const task of enabledTasks) {
        const jobFn = taskCatalog[task.taskId];
        if (jobFn && cron.validate(task.schedule)) {
            const job = cron.schedule(task.schedule, async () => {
                await jobFn();
            });
            runningJobs.set(task.id, job);
            console.log(`TASK SCHEDULED: [${task.name}] with frequency [${task.schedule}]`);
        } else {
            console.warn(`TASK FAILED TO SCHEDULE: [${task.name}] - Task ID not found or invalid cron expression.`);
        }
    }
    
    await logInfo('Scheduler initialized', { totalTasks: runningJobs.size });
}
