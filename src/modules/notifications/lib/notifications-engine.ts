
'use server';

/**
 * @fileoverview The "Brain" of the notification system. 
 * Orchestrates events, templates, and delivery services.
 */

import { getAllNotificationRules } from './db';
import { sendEmail } from '@/modules/core/lib/email-service';
import { sendTelegramMessage } from './telegram-service';
import { logInfo, logError } from '@/modules/core/lib/logger';

/**
 * Basic templates for different events. 
 * In a future phase, these can be moved to dedicated files.
 */
const eventTemplates: Record<string, (p: any) => { subject: string, body: string, telegram: string }> = {
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
                   style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; rounded: 5px;">
                   Ver Detalles del Ticket
                </a>
            </div>
        `;
        const telegram = `<b>🆕 NUEVO TICKET</b>\n\n<b>ID:</b> ${p.consecutive}\n<b>Cliente:</b> ${p.customerName}\n<b>Asunto:</b> ${p.subject}\n<b>Prioridad:</b> ${p.priority.toUpperCase()}`;
        return { subject, body, telegram };
    },
    'onTicketPriorityUrgent': (p) => {
        const subject = `⚠️ ALERTA: Ticket Urgente - ${p.consecutive}`;
        const body = `<h2 style="color: #dc2626;">Atención Requerida: Prioridad Urgente</h2><p>El ticket <b>${p.consecutive}</b> ha sido marcado como URGENTE.</p>`;
        const telegram = `⚠️ <b>TICKET URGENTE</b>\n\nEl caso <b>${p.consecutive}</b> requiere atención inmediata.\n\nAsunto: ${p.subject}`;
        return { subject, body, telegram };
    }
};

/**
 * Main entry point to trigger a notification flow.
 * @param eventId - The ID of the event defined in types (e.g., 'onTicketCreated')
 * @param payload - The data object associated with the event.
 */
export async function triggerNotificationEvent(eventId: string, payload: any) {
    try {
        const allRules = await getAllNotificationRules();
        const matchingRules = allRules.filter(rule => rule.event === eventId && rule.enabled);

        if (matchingRules.length === 0) return;

        const templateFn = eventTemplates[eventId];
        if (!templateFn) {
            console.warn(`No template found for event: ${eventId}`);
            return;
        }

        const { subject, body, telegram } = templateFn(payload);

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

        await logInfo(`Event '${eventId}' processed. ${matchingRules.length} rule(s) executed.`);
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Notification Engine failed to process event', { event: eventId, error: err.message });
    }
}
