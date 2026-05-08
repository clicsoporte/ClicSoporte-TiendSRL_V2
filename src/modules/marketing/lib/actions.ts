/**
 * @fileoverview Server actions for the Marketing Center UI.
 */
'use server';

import { getMarketingAds, saveMarketingAd, deleteMarketingAd } from './db';
import type { MarketingAd } from '@/modules/core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { revalidatePath } from 'next/cache';

export async function getAllAds(softwareId?: number): Promise<MarketingAd[]> {
    const ads = await getMarketingAds(softwareId);
    return JSON.parse(JSON.stringify(ads));
}

export async function saveAd(ad: Omit<MarketingAd, 'id' | 'createdAt'> & { id?: number }): Promise<MarketingAd> {
    try {
        const saved = await saveMarketingAd(ad);
        await logInfo(`Marketing Ad ${ad.id ? 'updated' : 'created'} for software ID ${ad.softwareId}`);
        revalidatePath('/dashboard/admin/marketing');
        return JSON.parse(JSON.stringify(saved));
    } catch (error: unknown) {
        logError("Failed to save marketing ad", { error: (error as Error).message });
        throw error;
    }
}

export async function deleteAd(id: number): Promise<void> {
    try {
        await deleteMarketingAd(id);
        await logInfo(`Marketing Ad deleted: ${id}`);
        revalidatePath('/dashboard/admin/marketing');
    } catch (error: unknown) {
        logError("Failed to delete marketing ad", { error: (error as Error).message });
        throw error;
    }
}
