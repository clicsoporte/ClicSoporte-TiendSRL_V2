
/**
 * @fileoverview API Endpoint for client verification and autocomplete.
 * Checks local database first, then falls back to Hacienda API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { getContributorInfo } from '@/modules/hacienda/lib/actions';
import type { Customer } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const taxId = searchParams.get('taxId')?.trim().toUpperCase();

        if (!taxId) {
            return NextResponse.json({ error: 'Tax ID is required' }, { status: 400 });
        }

        const db = await connectDb();

        // 1. Check local database
        const localCustomer = db.prepare('SELECT * FROM customers WHERE id = ? OR taxId = ?').get(taxId, taxId) as Customer | undefined;

        if (localCustomer) {
            return NextResponse.json({
                exists: true,
                source: 'local',
                data: {
                    name: localCustomer.name,
                    email: localCustomer.email || localCustomer.electronicDocEmail || '',
                    phone: localCustomer.phone || '',
                    isBlocked: !!localCustomer.isBlocked
                }
            });
        }

        // 2. If not found locally, check Hacienda API
        const haciendaInfo = await getContributorInfo(taxId);
        
        if (haciendaInfo && !('error' in haciendaInfo)) {
            return NextResponse.json({
                exists: true,
                source: 'hacienda',
                data: {
                    name: haciendaInfo.nombre,
                    email: '', // Hacienda doesn't provide this
                    phone: '', // Hacienda doesn't provide this
                    isBlocked: false
                }
            });
        }

        return NextResponse.json({
            exists: false,
            source: 'not_found',
            data: null
        });

    } catch (error: unknown) {
        console.error('Verify Client API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
