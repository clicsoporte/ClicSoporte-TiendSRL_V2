
'use server';

/**
 * @fileoverview The "Brain" of the notification system. 
 * Orchestrates events, templates from DB, and delivery services.
 */

import { getAllNotificationRules, createNotification, connectNotificationsDb } from './db';
import { sendEmail } from '../../core/lib/email-service';
import { sendTelegramMessage } from './telegram-service';
import { logInfo, logError } from '../../core/lib/logger';
import { getAllUsers } from '../../core/lib/auth';
import { connectDb } from '../../core/lib/db';
import type { NotificationEventId, Customer } from '../../core/types';

/**
 * Replaces placeholders in a template string using data from a payload.
 * Syntax: {{field}}
 * Supports simple {{#if field}}...{{/if}} logic for presence of fields.
 */
function applyTemplate(template: string, payload: Record<string, unknown>): string {
    // 1. Process IF blocks: {{#if field}}content{{/if}}
    let processed = template.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, field, content) => {
        return !!payload[field] ? content : '';
    });

    // 2. Process standard placeholders: {{field}}
    return processed.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return String(payload[key] ?? match);
    });
}

/**
 * Main entry point to trigger a notification flow.
 * @param eventId - The ID of the event
 * @param payload - The data object associated with the event.
 */
export async function triggerNotificationEvent(eventId: NotificationEventId, payload: Record<string, unknown>) {
    try {
        const db = await connectNotificationsDb();
        const template = db.prepare('SELECT * FROM notification_templates WHERE eventId = ?').get(eventId) as {
            subject: string;
            body: string;
            telegram: string;
            internal: string;
        } | undefined;

        if (!template) {
            console.warn(`No template found for event: ${eventId}`);
            return;
        }

        const allRules = await getAllNotificationRules();
        const matchingRules = allRules.filter(rule => rule.event === eventId && rule.enabled);

        const subject = applyTemplate(template.subject, payload);
        const body = applyTemplate(template.body, payload);
        const telegram = applyTemplate(template.telegram, payload);
        const internal = applyTemplate(template.internal, payload);

        // --- Internal App Notifications (Bell icon) ---
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

        // --- External/Rule-Based Notifications ---
        if (matchingRules.length === 0) return;

        // Resolve client data for dynamic placeholders
        let resolvedClientTelegramId = null;
        let resolvedClientEmail = null;
        let notifyTickets = true;
        let notifyLicenses = true;

        const mainDb = await connectDb();
        
        // Search by ID or Name
        const customer = mainDb.prepare('SELECT email, telegramChatId, notifyTickets, notifyLicenses FROM customers WHERE name = ? OR id = ?').get(payload.customerName, payload.customerId) as Customer | undefined;
        if (customer) {
            resolvedClientTelegramId = customer.telegramChatId;
            resolvedClientEmail = customer.email;
            notifyTickets = customer.notifyTickets !== false;
            notifyLicenses = customer.notifyLicenses !== false;
        }

        for (const rule of matchingRules) {
            const finalSubject = rule.subject || subject;

            // Handle special recipient placeholders with preference check
            const processedRecipients = rule.recipients.map(r => {
                const isClientPlaceholder = r === '[CORREO_CLIENTE]' || r === '[TELEGRAM_CLIENTE]';
                
                if (isClientPlaceholder) {
                    // Check granular preference based on event type
                    const isTicketEvent = eventId.startsWith('onTicket');
                    const isLicenseEvent = eventId.startsWith('onLicense');
                    
                    if (isTicketEvent && !notifyTickets) return '';
                    if (isLicenseEvent && !notifyLicenses) return '';

                    if (r === '[CORREO_CLIENTE]') return String(payload.customerEmail || resolvedClientEmail || '');
                    if (r === '[TELEGRAM_CLIENTE]') return String(payload.customerTelegramId || resolvedClientTelegramId || '');
                }
                
                return r;
            }).filter(Boolean);

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

        await logInfo(`Notification Engine: Event '${eventId}' processed. Rules executed: ${matchingRules.length}`);
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
        case 'onTicketCompleted':
        case 'onTicketCanceled':
        case 'onTicketReplyAdded':
        case 'onTicketPriorityUrgent': return `/dashboard/tickets/${v.id || v.ticketId}`;
        case 'onProjectCompleted': 
        case 'onProjectAdvanceAdded': return `/dashboard/planner/${v.id || v.projectId}`;
        case 'onNewSuggestion': return '/dashboard/admin/suggestions';
        case 'onContractExpiring': 
        case 'onContractAutoRenewed': return '/dashboard/contracts';
        case 'onLicenseExpiring': return '/dashboard/licenses';
        default: return '/dashboard';
    }
}

function getEntityTypeForEvent(eventId: string): string {
    if (eventId.startsWith('onTicket')) return 'ticket';
    if (eventId.startsWith('onProject')) return 'project';
    if (eventId.startsWith('onContract')) return 'contract';
    if (eventId.startsWith('onLicense')) return 'license';
    if (eventId === 'onNewSuggestion') return 'suggestion';
    return 'system';
}
