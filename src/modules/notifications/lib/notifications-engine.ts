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
                <p>Hola <b>${v.customerName}</b>, hemos recibido tu solicitud de soporte.</p>
                <hr>
                <p><b>ID del Caso:</b> ${v.consecutive}</p>
                <p><b>Asunto:</b> ${v.subject}</p>
                <p><b>Estado:</b> Abierto</p>
                <br>
                <p>Un técnico revisará tu caso a la brevedad.</p>
            </div>
        `;
        const telegram = `🆕 <b>NUEVO TICKET</b>\n\n<b>ID:</b> ${v.consecutive}\n<b>Cliente:</b> ${v.customerName}\n<b>Asunto:</b> ${v.subject}`;
        const internal = `Nuevo ticket ${v.consecutive} creado por ${v.customerName}`;
        return { subject, body, telegram, internal };
    },
    'onTicketStatusChanged': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `[ACTUALIZACIÓN] Ticket ${v.consecutive} - ${v.subject}`;
        const body = `
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #2563eb;">Cambio de Estado en tu Caso</h2>
                <p>Tu ticket <b>${v.consecutive}</b> ha cambiado de estado.</p>
                <hr>
                <p><b>Nuevo Estado:</b> <span style="text-transform: uppercase; font-weight: bold;">${v.status}</span></p>
                <p><b>Actualizado el:</b> ${new Date().toLocaleString()}</p>
            </div>
        `;
        const telegram = `🔄 <b>TICKET ACTUALIZADO</b>\n\n<b>ID:</b> ${v.consecutive}\n<b>Nuevo Estado:</b> ${String(v.status).toUpperCase()}`;
        const internal = `Ticket ${v.consecutive} cambió a ${v.status}`;
        return { subject, body, telegram, internal };
    },
    'onTicketClosed': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `[CASO CERRADO] Ticket ${v.consecutive} - ${v.subject}`;
        const body = `
            <div style="font-family: sans-serif; color: #333;">
                <h2 style="color: #16a34a;">Caso de Soporte Finalizado</h2>
                <p>Tu solicitud <b>${v.consecutive}</b> ha sido resuelta y marcada como cerrada.</p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #166534;">Solución Técnica:</h4>
                    <p style="font-size: 14px; line-height: 1.6;">${v.content || 'El caso fue resuelto satisfactoriamente.'}</p>
                </div>
                <p>Si consideras que el problema persiste, puedes responder a este correo para reabrir el caso.</p>
                <p>Gracias por confiar en <b>Clic-Soporte</b>.</p>
            </div>
        `;
        const telegram = `✅ <b>TICKET CERRADO</b>\n\n<b>ID:</b> ${v.consecutive}\n<b>Cliente:</b> ${v.customerName}\n<b>Resuelto por:</b> ${v.userName}`;
        const internal = `Ticket ${v.consecutive} cerrado con solución.`;
        return { subject, body, telegram, internal };
    },
    'onTicketReplyAdded': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `[NUEVO MENSAJE] Ticket ${v.consecutive}`;
        const body = `
            <div style="font-family: sans-serif; color: #333;">
                <h3 style="color: #2563eb;">Hay una nueva respuesta en tu ticket</h3>
                <p><b>${v.userName}</b> ha escrito:</p>
                <blockquote style="border-left: 4px solid #e2e8f0; padding-left: 15px; font-style: italic; color: #4b5563;">
                    ${v.content}
                </blockquote>
                <hr>
                <p style="font-size: 12px; color: #666;">Puedes ver la conversación completa en el portal de soporte.</p>
            </div>
        `;
        const telegram = `💬 <b>NUEVA RESPUESTA</b>\n\n<b>Ticket:</b> ${v.consecutive}\n<b>De:</b> ${v.userName}\n\n${v.content}`;
        const internal = `Nueva respuesta en ticket ${v.consecutive} por ${v.userName}`;
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
    'onProjectAdvanceAdded': (p) => {
        const v = p as Record<string, string | number>;
        const subject = `[AVANCE DE PROYECTO] ${v.consecutive} - ${v.name}`;
        const body = `
            <div style="font-family: sans-serif; color: #333;">
                <h3 style="color: #7c3aed;">Actualización en la Bitácora del Proyecto</h3>
                <p>Se ha registrado un nuevo avance en el proyecto <b>${v.name}</b>:</p>
                <div style="background-color: #f5f3ff; border-left: 4px solid #7c3aed; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;">${v.content}</p>
                </div>
                <p style="font-size: 12px; color: #666;">Registrado por: ${v.userName}</p>
            </div>
        `;
        const telegram = `🏗️ <b>AVANCE DE PROYECTO</b>\n\n<b>ID:</b> ${v.consecutive}\n<b>Avance:</b> ${v.content}`;
        const internal = `Nuevo avance en proyecto ${v.consecutive}`;
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

            // Handle special recipient placeholders
            const processedRecipients = rule.recipients.map(r => {
                if (r === '[CORREO_CLIENTE]' && payload.customerEmail) {
                    return String(payload.customerEmail);
                }
                return r;
            });

            if (rule.action === 'sendEmail' && processedRecipients.length > 0) {
                await sendEmail({
                    to: processedRecipients,
                    subject: finalSubject,
                    html: body
                });
            } else if (rule.action === 'sendTelegram' && processedRecipients.length > 0) {
                for (const chatId of processedRecipients) {
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
        case 'onTicketStatusChanged':
        case 'onTicketClosed':
        case 'onTicketReplyAdded':
        case 'onTicketPriorityUrgent': return `/dashboard/tickets/${v.id || v.ticketId}`;
        case 'onProjectCompleted': 
        case 'onProjectAdvanceAdded': return `/dashboard/planner/${v.id || v.projectId}`;
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
