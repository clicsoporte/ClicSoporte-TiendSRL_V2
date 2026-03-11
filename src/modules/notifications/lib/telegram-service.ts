
'use server';

/**
 * @fileoverview Service for sending notifications via Telegram Bot API.
 */

import { getNotificationServiceSettings } from './db';
import { logError, logInfo } from '@/modules/core/lib/logger';

/**
 * Sends a message to a specific Telegram Chat ID using the configured bot token.
 * @param message - The text message to send (supports HTML tags).
 * @param chatId - The destination chat or group ID.
 */
export async function sendTelegramMessage(message: string, chatId: string) {
    try {
        const settings = await getNotificationServiceSettings('telegram');
        const token = settings.telegram?.botToken;
        const defaultChatId = settings.telegram?.chatId;

        const targetChatId = chatId || defaultChatId;

        if (!token || !targetChatId) {
            console.warn('Telegram Bot not configured. Skipping message.');
            return;
        }

        // We use standard fetch to communicate with Telegram API
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: targetChatId,
                text: message,
                parse_mode: 'HTML',
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Telegram API Error: ${JSON.stringify(error)}`);
        }

        await logInfo('Telegram notification sent successfully', { chatId: targetChatId });
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Failed to send Telegram message', { error: err.message, chatId });
    }
}
