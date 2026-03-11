/**
 * @fileoverview Server Actions specifically for handling user suggestions.
 * This file isolates the database logic for suggestions to prevent bundling issues.
 */
"use server";

import { connectDb } from './db';
import type { Suggestion } from '../types';
import { revalidatePath } from 'next/cache';
import { addLog } from './logger-db';
import { triggerNotificationEvent } from '@/modules/notifications/lib/notifications-engine';

/**
 * Inserts a new suggestion into the database.
 * @param content - The text of the suggestion.
 * @param userId - The ID of the user submitting the suggestion.
 * @param userName - The name of the user submitting the suggestion.
 */
export async function addSuggestion(content: string, userId: number, userName: string): Promise<void> {
    const db = await connectDb();
    const info = db.prepare('INSERT INTO suggestions (content, userId, userName, isRead, timestamp) VALUES (?, ?, ?, 0, ?)')
      .run(content, userId, userName, new Date().toISOString());
    
    // Notification Trigger
    await triggerNotificationEvent('onNewSuggestion', { 
        id: Number(info.lastInsertRowid),
        userName, 
        content 
    });

    await addLog({ type: "INFO", message: 'New suggestion submitted', details: { user: userName } });
    revalidatePath('/dashboard/admin/suggestions');
}

/**
 * Retrieves all suggestions from the database.
 * @returns {Promise<Suggestion[]>} A promise that resolves to an array of suggestion entries.
 */
export async function getSuggestions(): Promise<Suggestion[]> {
  const db = await connectDb();
  const results = db.prepare('SELECT * FROM suggestions ORDER BY timestamp DESC').all() as Suggestion[];
  return JSON.parse(JSON.stringify(results));
}

/**
 * Marks a suggestion as read.
 * @param {number} id - The ID of the suggestion to mark as read.
 */
export async function markSuggestionAsRead(id: number): Promise<void> {
  const db = await connectDb();
  db.prepare('UPDATE suggestions SET isRead = 1 WHERE id = ?').run(id);
  revalidatePath('/dashboard/admin/suggestions');
}

/**
 * Deletes a suggestion from the database.
 * @param {number} id - The ID of the suggestion to delete.
 */
export async function deleteSuggestion(id: number): Promise<void> {
  const db = await connectDb();
  db.prepare('DELETE FROM suggestions WHERE id = ?').run(id);
  revalidatePath('/dashboard/admin/suggestions');
}

/**
 * Retrieves the count of unread suggestions.
 * @returns {Promise<number>} A promise that resolves to the number of unread suggestions.
 */
export async function getUnreadSuggestionsCount(): Promise<number> {
    const db = await connectDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM suggestions WHERE isRead = 0').get() as { count: number };
    return result.count;
}
