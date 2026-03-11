'use server';

/**
 * @fileoverview The "Brain" of the notification system. 
 * Orchestrates events, templates, and delivery services.
 */

import { getAllNotificationRules, createNotification } from './db';
import { sendEmail } from '@/modules/core/lib/email-service';
import { sendTelegramMessage } from './telegram-service';
import { logInfo, logError } from '../../core/lib/logger';
import { getAllUsers } from '../../core/lib/auth';
import type { NotificationEventId } from '../../core/types';

/**
 * Basic templates for different events. 
 */
const eventTemplates: Record<string, (p: any) => { subject: string, body: string, telegram: string, internal: string }> = {
    'onTicketCreated': (p) => {
        const subject = `[NUEVO TICKET] ${p.consecutive} - ${p.subject}`;
        const body = `
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #2563eb;">Nuevo Ticket Registrado</h2>
                <p>Se ha abierto un nuevo caso de soporte en la plataforma.</p>
                <hr>
                <p><b>ID:</b> ${p.consecutive}</p>
                <p><b>Cliente:</b> ${p.customerName}</p>
                <p><b>Asunto:</b> ${p.subject}</p>
                <p><b>Prioridad:</b> ${p.priority.toUpperCase()}</p>
                <br>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard/tickets/${p.id}" 
                   style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                   Ver Detalles del Ticket
                </a>
            </div>
        `;
        const telegram = `🆕 <b>NUEVO TICKET</b>\n\n<b>ID:</b> ${p.consecutive}\n<b>Cliente:</b> ${p.customerName}\n<b>Asunto:</b> ${p.subject}\n<b>Prioridad:</b> ${p.priority.toUpperCase()}`;
        const internal = `Nuevo ticket ${p.consecutive} creado por ${p.customerName}`;
        return { subject, body, telegram, internal };
    },
    'onTicketPriorityUrgent': (p) => {
        const subject = `⚠️ ALERTA: Ticket Urgente - ${p.consecutive}`;
        const body = `<h2 style="color: #dc2626;">Atención Requerida: Prioridad Urgente</h2><p>El ticket <b>${p.consecutive}</b> ha sido marcado como URGENTE.</p><p>Asunto: ${p.subject}</p>`;
        const telegram = `⚠️ <b>TICKET URGENTE</b>\n\nEl caso <b>${p.consecutive}</b> requiere atención inmediata.\n\nAsunto: ${p.subject}`;
        const internal = `ATENCIÓN: El ticket ${p.consecutive} es URGENTE.`;
        return { subject, body, telegram, internal };
    },
    'onContractExpiring': (p) => {
        const subject = `📅 AVISO: Contrato por Vencer - ${p.consecutive}`;
        const body = `<h2>Contrato de Soporte Próximo a Vencer</h2><p>El contrato <b>${p.name}</b> para el cliente <b>${p.customerId}</b> vence en <b>${p.daysLeft} días</b> (${p.endDate}).</p>`;
        const telegram = `📅 <b>CONTRATO POR VENCER</b>\n\nContrato: ${p.name}\nQuedan: ${p.daysLeft} días\nVence: ${p.endDate}`;
        const internal = `El contrato ${p.consecutive} de ${p.customerId} vence pronto.`;
        return { subject, body, telegram, internal };
    },
    'onLicenseExpiring': (p) => {
        const subject = `🔑 ALERTA: Licencia por Vencer`;
        const body = `<h2>Expiración de Licencia Offline</h2><p>La licencia para el cliente con Hardware ID <b>${p.hardwareId}</b> vence en <b>${p.daysLeft} días</b>.</p>`;
        const telegram = `🔑 <b>LICENCIA POR VENCER</b>\n\nHardware ID: ${p.hardwareId}\nQuedan: ${p.daysLeft} días`;
        const internal = `Licencia offline (${p.hardwareId}) está por vencer.`;
        return { subject, body, telegram, internal };
    },
    'onProjectCompleted': (p) => {
        const subject = `✅ PROYECTO FINALIZADO: ${p.consecutive}`;
        const body = `<h2>Hito Alcanzado: Proyecto Completado</h2><p>El proyecto TI <b>${p.name}</b> para <b>${p.customerName}</b> ha sido marcado como FINALIZADO.</p>`;
        const telegram = `✅ <b>PROYECTO FINALIZADO</b>\n\nProyecto: ${p.name}\nCliente: ${p.customerName}`;
        const internal = `El proyecto ${p.consecutive} ha sido finalizado exitosamente.`;
        return { subject, body, telegram, internal };
    },
    'onNewSuggestion': (p) => {
        const subject = `💡 NUEVA SUGERENCIA RECIBIDA`;
        const body = `<h2>Buzón de Sugerencias</h2><p>El usuario <b>${p.userName}</b> ha enviado una nueva sugerencia:</p><blockquote style="font-style: italic;">"${p.content}"</blockquote>`;
        const telegram = `💡 <b>NUEVA SUGERENCIA</b>\n\n<b>De:</b> ${p.userName}\n<b>Contenido:</b> ${p.content}`;
        const internal = `Nueva sugerencia recibida de ${p.userName}.`;
        return { subject, body, telegram, internal };
    },
    'onBackupCompleted': (p) => {
        const subject = `🛡️ RESPALDO DEL SISTEMA EXITOSO`;
        const body = `<p>Se ha completado una copia de seguridad de todas las bases de datos a las ${p.timestamp}.</p>`;
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
export async function triggerNotificationEvent(eventId: NotificationEventId, payload: any) {
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
                entityId: payload.id,
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

function getHrefForEvent(eventId: string, p: any): string {
    switch (eventId) {
        case 'onTicketCreated':
        case 'onTicketPriorityUrgent': return `/dashboard/tickets/${p.id}`;
        case 'onProjectCompleted': return `/dashboard/planner/${p.id}`;
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
