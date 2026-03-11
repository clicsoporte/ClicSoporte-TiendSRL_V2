'use server';

/**
 * @fileoverview The "Brain" of the notification system. 
 * Orchestrates events, templates, and delivery services.
 */

import { getAllNotificationRules, createNotification } from './db';
import { sendEmail } from '../../core/lib/email-service';
import { sendTelegramMessage } from './telegram-service';
import { logInfo, logError } from '../../core/lib/logger';
import { getAllUsers } from '../../core/lib/auth';
import type { NotificationEventId } from '../../core/types';

/**
 * Basic templates for different events. 
 */
const eventTemplates: Record<string, (p: Record<string, unknown>) => { subject: string, body: string, telegram: string, internal: string }> = {
    'onTicketCreated': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `[NUEVO TICKET] ${v.consecutive} - ${v.subject}`;
        const body = `
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #2563eb;">Nuevo Ticket Registrado</h2>
                <p>Se ha abierto un nuevo caso de soporte en la plataforma.</p>
                <hr>
                <p><b>ID:</b> ${v.consecutive}</p>
                <p><b>Cliente:</b> ${v.customerName}</p>
                <p><b>Asunto:</b> ${v.subject}</p>
                <p><b>Prioridad:</b> ${String(v.priority).toUpperCase()}</p>
                <br>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/tickets/${v.id}" 
                   style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                   Ver Detalles del Ticket
                </a>
            </div>
        `;
        const telegram = `🆕 <b>NUEVO TICKET</b>\n\n<b>ID:</b> ${v.consecutive}\n<b>Cliente:</b> ${v.customerName}\n<b>Asunto:</b> ${v.subject}\n<b>Prioridad:</b> ${String(v.priority).toUpperCase()}`;
        const internal = `Nuevo ticket ${v.consecutive} creado por ${v.customerName}`;
        return { subject, body, telegram, internal };
    },
    'onTicketPriorityUrgent': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `⚠️ ALERTA: Ticket Urgente - ${v.consecutive}`;
        const body = `<h2 style="color: #dc2626;">Atención Requerida: Prioridad Urgente</h2><p>El ticket <b>${v.consecutive}</b> ha sido marcado como URGENTE.</p><p>Asunto: ${v.subject}</p>`;
        const telegram = `⚠️ <b>TICKET URGENTE</b>\n\nEl caso <b>${v.consecutive}</b> requiere atención inmediata.\n\nAsunto: ${v.subject}`;
        const internal = `ATENCIÓN: El ticket ${v.consecutive} es URGENTE.`;
        return { subject, body, telegram, internal };
    },
    'onContractExpiring': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `📅 AVISO: Contrato por Vencer - ${v.consecutive}`;
        const body = `<h2>Contrato de Soporte Próximo a Vencer</h2><p>El contrato <b>${v.name}</b> para el cliente <b>${v.customerId}</b> vence en <b>${v.daysLeft} días</b> (${v.endDate}).</p>`;
        const telegram = `📅 <b>CONTRATO POR VENCER</b>\n\nContrato: ${v.name}\nQuedan: ${v.daysLeft} días\nVence: ${v.endDate}`;
        const internal = `El contrato ${v.consecutive} de ${v.customerId} vence pronto.`;
        return { subject, body, telegram, internal };
    },
    'onLicenseExpiring': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `🔑 ALERTA: Licencia por Vencer`;
        const body = `<h2>Expiración de Licencia Offline</h2><p>La licencia para el cliente con Hardware ID <b>${v.hardwareId}</b> vence en <b>${v.daysLeft} días</b>.</p>`;
        const telegram = `🔑 <b>LICENCIA POR VENCER</b>\n\nHardware ID: ${v.hardwareId}\nQuedan: ${v.daysLeft} días`;
        const internal = `Licencia offline (${v.hardwareId}) está por vencer.`;
        return { subject, body, telegram, internal };
    },
    'onProjectCompleted': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `✅ PROYECTO FINALIZADO: ${v.consecutive}`;
        const body = `<h2>Hito Alcanzado: Proyecto Completado</h2><p>El proyecto TI <b>${v.name}</b> para <b>${v.customerName}</b> ha sido marcado como FINALIZADO.</p>`;
        const telegram = `✅ <b>PROYECTO FINALIZADO</b>\n\nProyecto: ${v.name}\nCliente: ${v.customerName}`;
        const internal = `El proyecto ${v.consecutive} ha sido finalizado exitosamente.`;
        return { subject, body, telegram, internal };
    },
    'onNewSuggestion': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `💡 NUEVA SUGERENCIA RECIBIDA`;
        const body = `<h2>Buzón de Sugerencias</h2><p>El usuario <b>${v.userName}</b> ha enviado una nueva sugerencia:</p><blockquote style="font-style: italic;">"${v.content}"</blockquote>`;
        const telegram = `💡 <b>NUEVA SUGERENCIA</b>\n\n<b>De:</b> ${v.userName}\n<b>Contenido:</b> ${v.content}`;
        const internal = `Nueva sugerencia recibida de ${v.userName}.`;
        return { subject, body, telegram, internal };
    },
    'onBackupCompleted': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `🛡️ RESPALDO DEL SISTEMA EXITOSO`;
        const body = `<p>Se ha completado una copia de seguridad de todas las bases de datos a las ${v.timestamp}.</p>`;
        const telegram = `🛡️ <b>BACKUP EXITOSO</b>\n\nSe ha creado un punto de restauración del sistema.`;
        const internal = `Copia de seguridad completa realizada correctamente.`;
        return { subject, body, telegram, internal };
    }
};

/**
 * Main entry point to trigger a notification flow.
 * @param eventId - The ID of the event
 * @param payload - The data object associated with the event.
 */
export async function triggerNotificationEvent(eventId: NotificationEventId, payload: Record<string, unknown>) {
    try {
        const allRules = await getAllNotificationRules();
        const matchingRules = allRules.filter(rule => rule.event === eventId && rule.enabled);

        const templateFn = eventTemplates[eventId];
        if (!templateFn) return;

        const { subject, body, telegram, internal } = templateFn(payload);

        // --- Internal App Notifications ---
        const allUsers = await getAllUsers();
        const targetUsers = allUsers.filter(u => u.role === 'admin' || u.role === 'support-agent');
        
        for (const targetUser of targetUsers) {
            await createNotification({
                userId: targetUser.id,
                message: internal,
                href: getHrefForEvent(eventId, payload),
                entityId: typeof payload.id === 'number' ? payload.id : undefined,
                entityType: getEntityTypeForEvent(eventId)
            });
        }

        // --- External Notifications (Rules Based) ---
        if (matchingRules.length === 0) return;

        for (const rule of matchingRules) {
            const finalSubject = rule.subject || subject;

            if (rule.action === 'sendEmail' && rule.recipients.length > 0) {
                await sendEmail({
                    to: rule.recipients,
                    subject: finalSubject,
                    html: body
                });
            } else if (rule.action === 'sendTelegram' && rule.recipients.length > 0) {
                for (const chatId of rule.recipients) {
                    await sendTelegramMessage(telegram, chatId);
                }
            }
        }

        await logInfo(`Event '${eventId}' processed. Internal alerts and ${matchingRules.length} rule(s) executed.`);
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Notification Engine failed to process event', { event: eventId, error: err.message });
    }
}

function getHrefForEvent(eventId: string, p: Record<string, unknown>): string {
    const v = p as Record<string, string | number>;
    switch (eventId) {
        case 'onTicketCreated':
        case 'onTicketPriorityUrgent': return `/dashboard/tickets/${v.id}`;
        case 'onProjectCompleted': return `/dashboard/planner/${v.id}`;
        case 'onNewSuggestion': return '/dashboard/admin/suggestions';
        case 'onContractExpiring': return '/dashboard/contracts';
        case 'onLicenseExpiring': return '/dashboard/licenses';
        default: return '/dashboard';
    }
}

function getEntityTypeForEvent(eventId: string): string {
    if (eventId.startsWith('onTicket')) return 'ticket';
    if (eventId.startsWith('onProject')) return 'project';
    if (eventId === 'onNewSuggestion') return 'suggestion';
    return 'system';
}
