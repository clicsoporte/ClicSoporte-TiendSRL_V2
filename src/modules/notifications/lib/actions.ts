'use server';

/**
 * @fileoverview Server Actions for the Notifications module.
 */

import { 
    getAllNotificationRules as getAllRulesServer, 
    getNotificationRuleById,
    saveNotificationRule as saveRuleServer, 
    deleteNotificationRule as deleteRuleServer,
    getAllScheduledTasks as getAllTasksServer,
    saveScheduledTask as saveTaskServer,
    deleteScheduledTask as deleteTaskServer,
    getNotificationServiceSettings as getSettingsServer,
    saveNotificationServiceSettings as saveSettingsServer,
    connectNotificationsDb
} from './db';
import { sendTelegramMessage, getTelegramUpdates } from './telegram-service';
import { sendEmail, getEmailSettings } from '../../core/lib/email-service';
import type { NotificationRule, ScheduledTask, NotificationServiceConfig } from '@/modules/core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { initScheduler } from './scheduler';
import { authorizeAction } from '@/modules/core/lib/auth-guard';
import { format } from 'date-fns';

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
 * Tests a single notification rule using a dummy payload.
 */
export async function testNotificationRule(ruleId: number): Promise<{ success: boolean; message: string }> {
    await authorizeAction('admin:access');
    try {
        const rule = await getNotificationRuleById(ruleId);
        if (!rule) throw new Error("Regla no encontrada.");

        const db = await connectNotificationsDb();
        const template = db.prepare('SELECT * FROM notification_templates WHERE eventId = ?').get(rule.event) as {
            subject: string;
            body: string;
            telegram: string;
        } | undefined;

        if (!template) throw new Error(`No existe una plantilla para el evento: ${rule.event}`);

        const dummyPayload = {
            consecutive: 'TEST-999999',
            subject: 'ASUNTO DE PRUEBA DEL SISTEMA',
            customerName: 'Contacto de Prueba',
            companyName: 'Empresa Demo S.A.',
            serviceName: 'Soporte Técnico Nivel 1',
            assigneeName: 'Técnico Especialista',
            status: 'ABIERTO / TEST',
            priority: 'MEDIA / TEST',
            content: 'Este es un mensaje de prueba para verificar que la configuración de la regla "' + rule.name + '" funciona correctamente.',
            formattedDateTime: format(new Date(), 'dd/MM/yyyy HH:mm'),
            formattedPrice: '¢50,000.00',
            isBillable: true,
            name: 'Contrato de Prueba 2024',
            daysLeft: 7,
            endDate: format(new Date(), 'dd/MM/yyyy'),
            softwareName: 'Software Corporativo Demo',
            expirationDate: format(new Date(), 'dd/MM/yyyy'),
            userName: 'Administrador de Pruebas',
            type: 'Propio / SaaS'
        };

        // Helper to apply simple template syntax
        const apply = (str: string, p: Record<string, unknown>) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(p[k] ?? _));

        const finalSubject = apply(rule.subject || template.subject, dummyPayload);
        const finalBody = apply(template.body, dummyPayload);
        const finalTelegram = apply(template.telegram, dummyPayload);

        // Resolve recipients (handle placeholders for tests using default settings)
        const settings = await getSettingsServer('telegram');
        const emailSettings = await getEmailSettings();

        const testRecipients = rule.recipients.map(r => {
            if (r === '[TELEGRAM_CLIENTE]') return settings.telegram?.chatId || '';
            if (r === '[CORREO_CLIENTE]') return emailSettings.smtpUser || '';
            return r;
        }).filter(Boolean);

        if (testRecipients.length === 0) throw new Error("No hay destinatarios válidos para la prueba.");

        if (rule.action === 'sendEmail') {
            await sendEmail({
                to: testRecipients,
                subject: finalSubject,
                html: finalBody
            });
        } else {
            for (const chatId of testRecipients) {
                await sendTelegramMessage(finalTelegram, chatId);
            }
        }

        await logInfo(`Manual test of rule ${rule.name} successful.`);
        return { success: true, message: `Prueba enviada a ${testRecipients.length} destinatario(s).` };

    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to test notification rule`, { error: err.message, ruleId });
        return { success: false, message: err.message };
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
