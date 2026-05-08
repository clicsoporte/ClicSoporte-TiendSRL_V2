/**
 * @fileoverview Server-side database functions for the Marketing module.
 */
"use server";

import { connectDb } from '@/modules/core/lib/db';
import type { MarketingAd } from '@/modules/core/types';
import { authorizeAction } from '@/modules/core/lib/auth-guard';

export async function getMarketingAds(softwareId?: number): Promise<MarketingAd[]> {
    const db = await connectDb();
    let query = 'SELECT * FROM marketing_ads';
    const params: any[] = [];

    if (softwareId) {
        query += ' WHERE softwareId = ?';
        params.push(softwareId);
    }

    query += ' ORDER BY createdAt DESC';
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({ ...r, isEnabled: r.isEnabled === 1 }));
}

export async function saveMarketingAd(ad: Omit<MarketingAd, 'id' | 'createdAt'> & { id?: number }): Promise<MarketingAd> {
    await authorizeAction('admin:marketing:manage');
    const db = await connectDb();
    const now = new Date().toISOString();

    if (ad.id) {
        db.prepare(`
            UPDATE marketing_ads SET 
                softwareId = ?, imageUrl = ?, description = ?, price = ?, 
                targetUrl = ?, isEnabled = ?, targetType = ?
            WHERE id = ?
        `).run(ad.softwareId, ad.imageUrl, ad.description, ad.price, ad.targetUrl, ad.isEnabled ? 1 : 0, ad.targetType, ad.id);
        
        return { ...ad, createdAt: now } as MarketingAd;
    } else {
        const info = db.prepare(`
            INSERT INTO marketing_ads (softwareId, imageUrl, description, price, targetUrl, isEnabled, targetType, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(ad.softwareId, ad.imageUrl, ad.description, ad.price, ad.targetUrl, ad.isEnabled ? 1 : 0, ad.targetType, now);
        
        return { ...ad, id: Number(info.lastInsertRowid), createdAt: now } as MarketingAd;
    }
}

export async function deleteMarketingAd(id: number): Promise<void> {
    await authorizeAction('admin:marketing:manage');
    const db = await connectDb();
    db.prepare('DELETE FROM marketing_ads WHERE id = ?').run(id);
}

/**
 * Internal delivery: Get active ads for a software product.
 */
export async function getActiveAdsForSoftware(softwareName: string, status?: string): Promise<MarketingAd[]> {
    const db = await connectDb();
    
    // Resolve software
    const product = db.prepare('SELECT id FROM software_products WHERE name = ?').get(softwareName) as { id: number } | undefined;
    if (!product) return [];

    let query = "SELECT * FROM marketing_ads WHERE softwareId = ? AND isEnabled = 1";
    const params: any[] = [product.id];

    if (status) {
        query += " AND (targetType = 'all' OR targetType = ?)";
        params.push(status);
    } else {
        query += " AND targetType = 'all'";
    }

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({ 
        imageUrl: r.imageUrl, 
        description: r.description, 
        price: r.price,
        targetUrl: r.targetUrl
    })) as unknown as MarketingAd[];
}
