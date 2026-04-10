
'use server';

/**
 * @fileoverview Server actions for the IT Tools module.
 */

import { connectDb } from "@/modules/core/lib/db";
import type { ITNote } from "@/modules/core/types";
import { authorizeAction } from "@/modules/core/lib/auth-guard";
import { logInfo, logError } from "@/modules/core/lib/logger";
import { revalidatePath } from "next/cache";

/**
 * Retrieves all IT notes from the database.
 */
export async function getNotes(): Promise<ITNote[]> {
    const db = await connectDb();
    try {
        const rows = db.prepare('SELECT * FROM it_notes ORDER BY createdAt DESC').all() as ITNote[];
        return JSON.parse(JSON.stringify(rows));
    } catch (error) {
        console.error("Failed to fetch IT notes:", error);
        return [];
    }
}

/**
 * Saves a new IT note or updates an existing one.
 */
export async function saveNote(note: Omit<ITNote, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }): Promise<ITNote> {
    await authorizeAction(note.id ? 'it-tools:notes:update' : 'it-tools:notes:create');
    const db = await connectDb();
    const now = new Date().toISOString();

    try {
        if (note.id) {
            db.prepare(`
                UPDATE it_notes 
                SET title = ?, content = ?, customerId = ?, tags = ?, updatedAt = ? 
                WHERE id = ?
            `).run(note.title, note.content, note.customerId || null, note.tags || null, now, note.id);
            
            await logInfo(`IT Note updated: ${note.title}`);
            const updated = db.prepare('SELECT * FROM it_notes WHERE id = ?').get(note.id) as ITNote;
            revalidatePath('/dashboard/it-tools/notes');
            return JSON.parse(JSON.stringify(updated));
        } else {
            const info = db.prepare(`
                INSERT INTO it_notes (title, content, customerId, tags, createdBy, createdAt, updatedAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(note.title, note.content, note.customerId || null, note.tags || null, note.createdBy, now, now);
            
            await logInfo(`New IT Note created: ${note.title}`);
            const created = db.prepare('SELECT * FROM it_notes WHERE id = ?').get(info.lastInsertRowid) as ITNote;
            revalidatePath('/dashboard/it-tools/notes');
            return JSON.parse(JSON.stringify(created));
        }
    } catch (error: unknown) {
        const err = error as Error;
        logError("Failed to save IT note", { error: err.message });
        throw err;
    }
}

/**
 * Deletes an IT note.
 */
export async function deleteNote(id: number): Promise<void> {
    await authorizeAction('it-tools:notes:delete');
    const db = await connectDb();
    try {
        db.prepare('DELETE FROM it_notes WHERE id = ?').run(id);
        await logInfo(`IT Note deleted ID: ${id}`);
        revalidatePath('/dashboard/it-tools/notes');
    } catch (error: unknown) {
        const err = error as Error;
        logError("Failed to delete IT note", { error: err.message, id });
        throw err;
    }
}
