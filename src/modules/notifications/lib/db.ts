'use server';

/**
 * @fileoverview Server-side functions for the notifications database.
 * This file handles all direct interactions with the `notifications.db` SQLite database,
 * including schema initialization, migrations, and CRUD operations for rules, settings, and user notifications.
 */

import { connectDb } from '@/modules/core/lib/db-connection';
import type { NotificationRule, NotificationServiceConfig, ScheduledTask, Notification } from '@/modules/core/types';

const NOTIFICATIONS_DB_FILE = 'notifications.db';

export async function initializeNotificationsDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS notification_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            event TEXT NOT NULL,
            action TEXT NOT NULL,
            recipients TEXT NOT NULL,
            subject TEXT,
            enabled INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS notification_settings (
            service TEXT PRIMARY KEY,
            config TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            schedule TEXT NOT NULL,
            taskId TEXT NOT NULL,
            enabled INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            message TEXT NOT NULL,
            href TEXT,
            isRead INTEGER DEFAULT 0,
            timestamp TEXT NOT NULL,
            entityId INTEGER,
            entityType TEXT
        );
    `;
    db.exec(schema);
    
    // Default Telegram settings (empty)
    db.prepare(`
        INSERT OR IGNORE INTO notification_settings (service, config) 
        VALUES ('telegram', ?)
    `).run(JSON.stringify({ botToken: '', chatId: '' }));

    console.log(`Database ${NOTIFICATIONS_DB_FILE} initialized for Notifications Engine.`);
}

export async function runNotificationsMigrations() {
    // Migration logic can be added here
}

export async function connectNotificationsDb() {
    return connectDb(NOTIFICATIONS_DB_FILE, initializeNotificationsDb, runNotificationsMigrations);
}

// --- Rules ---
export async function getAllNotificationRules(): Promise<NotificationRule[]> {
    const db = await connectNotificationsDb();
    const rows = db.prepare('SELECT * FROM notification_rules ORDER BY name ASC').all() as (Omit<NotificationRule, 'enabled' | 'recipients'> & { enabled: number, recipients: string })[];
    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
        recipients: JSON.parse(row.recipients),
    }));
}

export async function saveNotificationRule(rule: Omit<NotificationRule, 'id'> | NotificationRule): Promise<NotificationRule> {
    const db = await connectNotificationsDb();
    const dataToSave = {
        ...rule,
        recipients: JSON.stringify(rule.recipients),
        enabled: rule.enabled ? 1 : 0,
    };

    if ('id' in rule && rule.id) {
        db.prepare(`
            UPDATE notification_rules SET
                name = @name,
                event = @event,
                action = @action,
                recipients = @recipients,
                subject = @subject,
                enabled = @enabled
            WHERE id = @id
        `).run(dataToSave);
        return rule as NotificationRule;
    } else {
        const info = db.prepare(`
            INSERT INTO notification_rules (name, event, action, recipients, subject, enabled)
            VALUES (@name, @event, @action, @recipients, @subject, @enabled)
        `).run(dataToSave);
        return { ...rule, id: Number(info.lastInsertRowid) } as NotificationRule;
    }
}

export async function deleteNotificationRule(id: number): Promise<void> {
    const db = await connectNotificationsDb();
    db.prepare('DELETE FROM notification_rules WHERE id = ?').run(id);
}

// --- Scheduled Tasks ---
export async function getAllScheduledTasks(): Promise<ScheduledTask[]> {
    const db = await connectNotificationsDb();
    const rows = db.prepare('SELECT * FROM scheduled_tasks ORDER BY name ASC').all() as (Omit<ScheduledTask, 'enabled'> & { enabled: number })[];
    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
    }));
}

export async function saveScheduledTask(task: Omit<ScheduledTask, 'id'> | ScheduledTask): Promise<ScheduledTask> {
    const db = await connectNotificationsDb();
    const dataToSave = { ...task, enabled: task.enabled ? 1 : 0 };

    if ('id' in task && task.id) {
        db.prepare('UPDATE scheduled_tasks SET name = @name, schedule = @schedule, taskId = @taskId, enabled = @enabled WHERE id = @id').run(dataToSave);
        return task as ScheduledTask;
    } else {
        const info = db.prepare('INSERT INTO scheduled_tasks (name, schedule, taskId, enabled) VALUES (@name, @schedule, @taskId, @enabled)').run(dataToSave);
        return { ...task, id: Number(info.lastInsertRowid) } as ScheduledTask;
    }
}

export async function deleteScheduledTask(id: number): Promise<void> {
    const db = await connectNotificationsDb();
    db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
}

// --- Settings ---
export async function getNotificationServiceSettings(service: 'telegram'): Promise<NotificationServiceConfig> {
    const db = await connectNotificationsDb();
    const row = db.prepare('SELECT config FROM notification_settings WHERE service = ?').get(service) as { config: string } | undefined;
    if (row) {
        return JSON.parse(row.config);
    }
    return {};
}

export async function saveNotificationServiceSettings(service: 'telegram', config: NotificationServiceConfig): Promise<void> {
    const db = await connectNotificationsDb();
    db.prepare('INSERT OR REPLACE INTO notification_settings (service, config) VALUES (?, ?)').run(service, JSON.stringify(config));
}

// --- User Notifications (The Bell Alerts) ---

export async function getNotifications(userId: number): Promise<Notification[]> {
    const db = await connectNotificationsDb();
    const rows = db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY timestamp DESC LIMIT 50').all(userId) as (Omit<Notification, 'isRead'> & { isRead: number })[];
    return rows.map(r => ({ 
        ...r, 
        isRead: (r.isRead === 1 ? 1 : 0) as 0 | 1 
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
    db.prepare(`
        INSERT INTO notifications (userId, message, href, isRead, timestamp, entityId, entityType)
        VALUES (@userId, @message, @href, 0, datetime('now'), @entityId, @entityType)
    `).run(notification);
}
