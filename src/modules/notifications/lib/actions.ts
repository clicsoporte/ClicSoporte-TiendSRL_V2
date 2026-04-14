'use server';

/**
 * @fileoverview Server Actions for the Notifications module.
 */

import { 
    getAllNotificationRules as getAllRulesServer, 
    saveNotificationRule as saveRuleServer, 
    deleteNotificationRule as deleteRuleServer,
    getAllScheduledTasks as getAllTasksServer,
    saveScheduledTask as saveTaskServer,
    deleteScheduledTask as deleteTaskServer,
    getNotificationServiceSettings as getSettingsServer,
    saveNotificationServiceSettings as saveSettingsServer
} from './db';
import { sendTelegramMessage, getTelegramUpdates } from './telegram-service';
import type { NotificationRule, ScheduledTask, NotificationServiceConfig } from '@/modules/core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { initScheduler } from './scheduler';
import { authorizeAction } from '@/modules/core/lib/auth-guard';

/**
 * Retrieves all notification rules for the UI.
 * Requires admin access.
 */
export async function getAllNotificationRules(): Promise<NotificationRule[]> {
    await authorizeAction('admin:access');
    const rules = await getAllRulesServer();
    return JSON.parse(JSON.stringify(rules));
}

export async function saveNotificationRule(rule: Omit<NotificationRule, 'id'> | NotificationRule): Promise<NotificationRule> {
    try {
        const result = await saveRuleServer(rule);
        await logInfo(`Notification rule saved: ${result.name}`);
        return JSON.parse(JSON.stringify(result));
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to save notification rule`, { error: err.message });
        throw err;
    }
}

export async function deleteNotificationRule(id: number): Promise<void> {
    try {
        await deleteRuleServer(id);
        await logInfo(`Notification rule deleted: ${id}`);
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to delete notification rule`, { error: err.message, id });
        throw err;
    }
}

/**
 * Retrieves all scheduled tasks for the UI.
 * Requires admin access.
 */
export async function getAllScheduledTasks(): Promise<ScheduledTask[]> {
    await authorizeAction('admin:access');
    const tasks = await getAllTasksServer();
    return JSON.parse(JSON.stringify(tasks));
}

export async function saveScheduledTask(task: Omit<ScheduledTask, 'id'> | ScheduledTask): Promise<ScheduledTask> {
    try {
        const result = await saveTaskServer(task);
        await logInfo(`Scheduled task saved: ${result.name}`, { enabled: result.enabled });
        // Re-initialize scheduler to apply changes immediately
        await initScheduler();
        return JSON.parse(JSON.stringify(result));
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to save scheduled task`, { error: err.message });
        throw err;
    }
}

export async function deleteScheduledTask(id: number): Promise<void> {
    try {
        await deleteTaskServer(id);
        await logInfo(`Scheduled task deleted: ${id}`);
        // Refresh schedule
        await initScheduler();
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to delete scheduled task`, { error: err.message, id });
        throw err;
    }
}

/**
 * Retrieves notification service settings for the UI.
 * Requires admin access.
 */
export async function getNotificationServiceSettings(service: 'telegram'): Promise<NotificationServiceConfig> {
    await authorizeAction('admin:access');
    const settings = await getSettingsServer(service);
    return JSON.parse(JSON.stringify(settings));
}

export async function saveNotificationServiceSettings(service: 'telegram', config: NotificationServiceConfig): Promise<void> {
    try {
        await saveSettingsServer(service, config);
        await logInfo('Notification service settings updated', { service });
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to save notification settings`, { error: err.message, service });
        throw err;
    }
}

export async function testTelegram(chatId?: string) {
    try {
        await sendTelegramMessage('🤖 <b>Mensaje de Prueba</b>\n\nLa conexión con Clic-Tools funciona correctamente.', chatId);
        return { success: true };
    } catch (error: unknown) {
        return { success: false, message: (error as Error).message };
    }
}

export async function fetchTelegramChatId() {
    return await getTelegramUpdates();
}
