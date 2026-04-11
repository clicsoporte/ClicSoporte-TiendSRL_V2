
'use server';

/**
 * @fileoverview Service for sending notifications and managing Telegram Bot API.
 */

import { getNotificationServiceSettings } from './db';
import { logError, logInfo } from '@/modules/core/lib/logger';

/**
 * Sends a message to a specific Telegram Chat ID using the configured bot token.
 * @param message - The text message to send (supports HTML tags).
 * @param chatId - The destination chat or group ID.
 */
export async function sendTelegramMessage(message: string, chatId?: string) {
    try {
        const settings = await getNotificationServiceSettings('telegram');
        const token = settings.telegram?.botToken;
        const defaultChatId = settings.telegram?.chatId;

        const targetChatId = chatId || defaultChatId;

        if (!token || !targetChatId) {
            console.warn('Telegram Bot not configured. Skipping message.');
            return;
        }

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
        throw err;
    }
}

/**
 * Fetches the most recent updates from Telegram to find valid Chat IDs.
 */
export async function getTelegramUpdates() {
    try {
        const settings = await getNotificationServiceSettings('telegram');
        const token = settings.telegram?.botToken;

        if (!token) throw new Error("Token de bot no configurado.");

        const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
            cache: 'no-store'
        });

        if (!response.ok) throw new Error("No se pudo conectar con Telegram API.");

        const data = await response.json();
        
        if (!data.ok || !data.result || data.result.length === 0) {
            throw new Error("No se encontraron mensajes recientes. Envía un mensaje a tu bot primero.");
        }

        // Get the latest message to extract the ID
        const lastUpdate = data.result[data.result.length - 1];
        const chat = lastUpdate.message?.chat || lastUpdate.callback_query?.message?.chat;

        if (!chat) throw new Error("No se pudo identificar un chat válido en las actualizaciones.");

        return {
            id: String(chat.id),
            name: chat.title || chat.username || chat.first_name || 'Chat Detectado'
        };
    } catch (error: unknown) {
        const err = error as Error;
        await logError('Failed to fetch Telegram updates', { error: err.message });
        throw err;
    }
}
