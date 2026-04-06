
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
import type { Contract, License, Customer } from '@/modules/core/types';
import { differenceInDays, parseISO, isSameDay } from 'date-fns';
import { autoRenewContract } from '@/modules/contracts/lib/db';

const runningJobs: Map<number, cron.ScheduledTask> = new Map();

/**
 * Task: Full ERP Synchronization.
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
        const db = await connectDb();
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // 1. Check Contracts
        const contracts = db.prepare("SELECT * FROM contracts WHERE status = 'active'").all() as Contract[];
        const customers = db.prepare("SELECT id, name FROM customers").all() as Pick<Customer, 'id' | 'name'>[];
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        for (const contract of contracts) {
            const expiryDate = parseISO(contract.endDate);
            const daysLeft = differenceInDays(expiryDate, now);
            
            // Alert at 30, 15, and 7 days
            if ([30, 15, 7].includes(daysLeft)) {
                await triggerNotificationEvent('onContractExpiring', { 
                    ...contract, 
                    customerName: customerMap.get(contract.customerId) || 'Desconocido',
                    daysLeft 
                });
            }
        }

        // 2. Check Licenses
        const licenses = db.prepare("SELECT * FROM licenses WHERE status = 'active' AND isPerpetual = 0").all() as License[];
        for (const license of licenses) {
            if (!license.expirationDate) continue;
            const expiryDate = parseISO(license.expirationDate);
            const daysLeft = differenceInDays(expiryDate, now);
            
            if ([30, 15, 7].includes(daysLeft)) {
                await triggerNotificationEvent('onLicenseExpiring', { 
                    hardwareId: license.hardwareId,
                    expirationDate: license.expirationDate,
                    daysLeft 
                });
            }
        }

        await logInfo('Vigilante de Vencimientos: Revisión diaria completada.');
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Vigilante de Vencimientos falló.', { error: err.message });
    }
}

/**
 * Task: Automatic Contract Renewal.
 */
async function executeAutoRenewals() {
    try {
        const db = await connectDb();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const toRenew = db.prepare(`
            SELECT * FROM contracts 
            WHERE status = 'active' 
            AND autoRenew = 1 
        `).all() as (Omit<Contract, 'autoRenew'> & { autoRenew: number })[];

        const customers = db.prepare("SELECT id, name FROM customers").all() as Pick<Customer, 'id' | 'name'>[];
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        let renewalCount = 0;
        for (const contract of toRenew) {
            const expiryDate = parseISO(contract.endDate);
            if (isSameDay(expiryDate, today)) {
                const renewed = await autoRenewContract(contract.id);
                await triggerNotificationEvent('onContractAutoRenewed', {
                    ...renewed,
                    customerName: customerMap.get(renewed.customerId) || 'Desconocido'
                });
                renewalCount++;
            }
        }

        if (renewalCount > 0) {
            await logInfo(`Renovación Automática: Se han renovado ${renewalCount} contrato(s).`);
        }
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Tarea de Renovación Automática falló.', { error: err.message });
    }
}

/**
 * Catalog of available background tasks.
 */
const taskCatalog: Record<string, () => Promise<void>> = {
    'erp-sync': executeErpSync,
    'backup-system': executeBackup,
    'check-expirations': executeExpirationCheck,
    'auto-renew-contracts': executeAutoRenewals,
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
        }
    }
    
    await logInfo('Scheduler re-initialized', { totalActiveTasks: runningJobs.size });
}
