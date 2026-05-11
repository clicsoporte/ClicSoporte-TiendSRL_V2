/**
 * @fileoverview Server-side functions for the notifications module.
 * Unified into intratool.db. Tables prefixed with ticket_.
 */
"use server";

import { connectDb } from '@/modules/core/lib/db';
import type { NotificationRule, NotificationServiceConfig, ScheduledTask, Notification, NotificationTemplate } from '@/modules/core/types';
import { authorizeAction } from '@/modules/core/lib/auth-guard';
import { logError } from '@/modules/core/lib/logger';

export async function connectNotificationsDb() {
    return connectDb();
}

interface NotificationRuleRow {
    id: number;
    name: string;
    event: string;
    action: string;
    recipients: string;
    subject: string;
    enabled: number;
}

/**
 * Retrieves all notification rules. 
 * Internal function: Does not check permissions to allow the engine to run for any user.
 */
export async function getAllNotificationRules(): Promise<NotificationRule[]> {
    const db = await connectNotificationsDb();
    try {
        const rows = db.prepare('SELECT * FROM notification_rules ORDER BY name ASC').all() as NotificationRuleRow[];
        return rows.map(row => ({
            ...row,
            action: row.action as 'sendEmail' | 'sendTelegram',
            enabled: Boolean(row.enabled),
            recipients: JSON.parse(row.recipients || '[]'),
        }));
    } catch (error) {
        console.error("Failed to get notification rules:", error);
        return [];
    }
}

export async function getNotificationRuleById(id: number): Promise<NotificationRule | null> {
    const db = await connectNotificationsDb();
    const row = db.prepare('SELECT * FROM notification_rules WHERE id = ?').get(id) as NotificationRuleRow | undefined;
    if (!row) return null;
    return {
        ...row,
        action: row.action as 'sendEmail' | 'sendTelegram',
        enabled: Boolean(row.enabled),
        recipients: JSON.parse(row.recipients || '[]'),
    };
}

export async function saveNotificationRule(rule: Omit<NotificationRule, 'id'> | NotificationRule): Promise<NotificationRule> {
    await authorizeAction('admin:settings:general');
    const db = await connectNotificationsDb();
    
    const params = {
        name: rule.name || '',
        event: rule.event || '',
        action: rule.action || 'sendEmail',
        recipients: JSON.stringify(rule.recipients || []),
        subject: rule.subject || null,
        enabled: rule.enabled ? 1 : 0,
        id: 'id' in rule ? rule.id : null
    };

    try {
        if (params.id) {
            db.prepare(`
                UPDATE notification_rules 
                SET name = @name, event = @event, action = @action, recipients = @recipients, subject = @subject, enabled = @enabled 
                WHERE id = @id
            `).run(params);
            return rule as NotificationRule;
        } else {
            const info = db.prepare(`
                INSERT INTO notification_rules (name, event, action, recipients, subject, enabled) 
                VALUES (@name, @event, @action, @recipients, @subject, @enabled)
            `).run(params);
            return { ...rule, id: Number(info.lastInsertRowid) } as NotificationRule;
        }
    } catch (error: unknown) {
        const err = error as Error;
        await logError("DB Error saving notification rule", { error: err.message, params });
        throw new Error(`No se pudo guardar la regla de notificación: ${err.message}`);
    }
}

export async function deleteNotificationRule(id: number): Promise<void> {
    await authorizeAction('admin:settings:general');
    const db = await connectNotificationsDb();
    db.prepare('DELETE FROM notification_rules WHERE id = ?').run(id);
}

interface ScheduledTaskRow {
    id: number;
    name: string;
    schedule: string;
    taskId: string;
    enabled: number;
}

/**
 * Retrieves all scheduled tasks.
 * Internal function: Used by the scheduler at startup.
 */
export async function getAllScheduledTasks(): Promise<ScheduledTask[]> {
    const db = await connectNotificationsDb();
    const rows = db.prepare('SELECT * FROM scheduled_tasks ORDER BY name ASC').all() as ScheduledTaskRow[];
    return rows.map(row => ({ ...row, enabled: Boolean(row.enabled) }));
}

export async function saveScheduledTask(task: Omit<ScheduledTask, 'id'> | ScheduledTask): Promise<ScheduledTask> {
    await authorizeAction('admin:settings:general');
    const db = await connectNotificationsDb();
    
    const params = {
        name: task.name || '',
        schedule: task.schedule || '',
        taskId: task.taskId || '',
        enabled: task.enabled ? 1 : 0,
        id: 'id' in task ? task.id : null
    };

    try {
        if (params.id) {
            db.prepare('UPDATE scheduled_tasks SET name = @name, schedule = @schedule, taskId = @taskId, enabled = @enabled WHERE id = @id').run(params);
            return task as ScheduledTask;
        } else {
            const info = db.prepare('INSERT INTO scheduled_tasks (name, schedule, taskId, enabled) VALUES (@name, @schedule, @taskId, @enabled)').run(params);
            return { ...task, id: Number(info.lastInsertRowid) } as ScheduledTask;
        }
    } catch (error: unknown) {
        const err = error as Error;
        await logError("DB Error saving scheduled task", { error: err.message, params });
        throw new Error(`No se pudo guardar la tarea programada: ${err.message}`);
    }
}

export async function deleteScheduledTask(id: number): Promise<void> {
    await authorizeAction('admin:settings:general');
    const db = await connectNotificationsDb();
    db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
}

/**
 * Retrieves notification service settings (e.g. Telegram config).
 * Internal function: Used by the engine to deliver messages.
 */
export async function getNotificationServiceSettings(service: 'telegram'): Promise<NotificationServiceConfig> {
    const db = await connectNotificationsDb();
    const row = db.prepare('SELECT config FROM notification_settings WHERE service = ?').get(service) as { config: string } | undefined;
    return row ? JSON.parse(row.config) : {};
}

export async function saveNotificationServiceSettings(service: 'telegram', config: NotificationServiceConfig): Promise<void> {
    await authorizeAction('admin:settings:general');
    const db = await connectNotificationsDb();
    db.prepare('INSERT OR REPLACE INTO notification_settings (service, config) VALUES (?, ?)').run(service, JSON.stringify(config));
}

interface NotificationRow {
    id: number;
    userId: number;
    message: string;
    href: string;
    isRead: number;
    timestamp: string;
    entityId: number | null;
    entityType: string | null;
}

export async function getNotifications(userId: number): Promise<Notification[]> {
    const db = await connectNotificationsDb();
    const rows = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY timestamp DESC LIMIT 50').all(userId) as NotificationRow[];
    return rows.map(r => ({ 
        ...r, 
        isRead: (r.isRead === 1 ? 1 : 0) as 0 | 1,
        entityId: r.entityId ?? undefined,
        entityType: r.entityType ?? undefined
    }));
}

export async function markNotificationsAsRead(notificationIds: number[], userId: number): Promise<void> {
    const db = await connectNotificationsDb();
    if (notificationIds.length === 0) return;
    const placeholders = notificationIds.map(() => '?').join(',');
    db.prepare(`UPDATE notifications SET isRead = 1 WHERE id IN (${placeholders}) AND userId = ?`).run(...notificationIds, userId);
}

export async function createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): Promise<void> {
    const db = await connectNotificationsDb();
    db.prepare(`INSERT INTO notifications (userId, message, href, isRead, timestamp, entityId, entityType) VALUES (@userId, @message, @href, 0, datetime('now'), @entityId, @entityType)`).run(notification);
}

/**
 * TEMPLATES MANAGEMENT
 */

export async function getAllNotificationTemplates(): Promise<NotificationTemplate[]> {
    const db = await connectNotificationsDb();
    try {
        const rows = db.prepare('SELECT * FROM notification_templates ORDER BY eventId ASC').all() as NotificationTemplate[];
        return JSON.parse(JSON.stringify(rows));
    } catch (error) {
        console.error("Failed to get notification templates:", error);
        return [];
    }
}

export async function updateNotificationTemplate(template: NotificationTemplate): Promise<void> {
    await authorizeAction('admin:settings:general');
    const db = await connectNotificationsDb();
    try {
        db.prepare(`
            UPDATE notification_templates 
            SET subject = @subject, body = @body, telegram = @telegram, internal = @internal 
            WHERE eventId = @eventId
        `).run(template);
    } catch (error: unknown) {
        const err = error as Error;
        await logError("DB Error updating notification template", { error: err.message, eventId: template.eventId });
        throw new Error(`No se pudo actualizar la plantilla: ${err.message}`);
    }
}
