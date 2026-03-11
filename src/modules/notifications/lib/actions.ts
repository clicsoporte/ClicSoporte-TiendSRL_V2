'use client';

/**
 * @fileoverview Client-side functions for the Notifications module.
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
import type { NotificationRule, ScheduledTask, NotificationServiceConfig } from '@/modules/core/types';
import { logInfo } from '@/modules/core/lib/logger';
import { initScheduler } from './scheduler';

export async function getAllNotificationRules(): Promise<NotificationRule[]> {
    return await getAllRulesServer();
}

export async function saveNotificationRule(rule: Omit<NotificationRule, 'id'> | NotificationRule): Promise<NotificationRule> {
    const result = await saveRuleServer(rule);
    await logInfo(`Notification rule saved: ${result.name}`);
    return result;
}

export async function deleteNotificationRule(id: number): Promise<void> {
    await deleteRuleServer(id);
    await logInfo(`Notification rule deleted: ${id}`);
}

export async function getAllScheduledTasks(): Promise<ScheduledTask[]> {
    return await getAllTasksServer();
}

export async function saveScheduledTask(task: Omit<ScheduledTask, 'id'> | ScheduledTask): Promise<ScheduledTask> {
    const result = await saveTaskServer(task);
    await logInfo(`Scheduled task saved: ${result.name}`, { enabled: result.enabled });
    // Re-initialize scheduler to apply changes immediately
    await initScheduler();
    return result;
}

export async function deleteScheduledTask(id: number): Promise<void> {
    await deleteTaskServer(id);
    await logInfo(`Scheduled task deleted: ${id}`);
    // Refresh schedule
    await initScheduler();
}

export async function getNotificationServiceSettings(service: 'telegram'): Promise<NotificationServiceConfig> {
    return await getSettingsServer(service);
}

export async function saveNotificationServiceSettings(service: 'telegram', config: any): Promise<void> {
    await saveSettingsServer(service, config);
    await logInfo('Notification service settings updated', { service });
}
