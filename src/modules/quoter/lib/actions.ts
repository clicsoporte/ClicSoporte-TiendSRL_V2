/**
 * @fileoverview Client-side functions for interacting with the quoter module's server-side DB functions.
 */
'use client';

import type { QuoteDraft } from '../../core/types';
import { 
    saveQuoteDraft as saveQuoteDraftServer,
    getAllQuoteDrafts as getAllQuoteDraftsServer,
    deleteQuoteDraft as deleteQuoteDraftServer,
} from './db';

export const saveQuoteDraft = async (draft: QuoteDraft): Promise<void> => saveQuoteDraftServer(draft);

export const getAllQuoteDrafts = async (userId: number): Promise<QuoteDraft[]> => {
    const drafts = await getAllQuoteDraftsServer(userId);
    return JSON.parse(JSON.stringify(drafts));
}

export const deleteQuoteDraft = async (draftId: string): Promise<void> => deleteQuoteDraftServer(draftId);
