/**
 * @fileoverview API Endpoint for client verification and autocomplete.
 * Refactored for Production Blindado: Strict TaxID normalization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { getContributorInfo } from '@/modules/hacienda/lib/actions';
import type { Customer } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rawTaxId = searchParams.get('taxId');

        if (!rawTaxId) {
            return NextResponse.json({ error: 'Tax ID is required' }, { status: 400 });
        }

        // Normalización estricta
        const taxId = rawTaxId.trim().toUpperCase();

        const db = await connectDb();

        // 1. Check local database
        const localCustomer = db.prepare('SELECT * FROM customers WHERE id = ? OR taxId = ?').get(taxId, taxId) as Customer | undefined;

        if (localCustomer) {
            return NextResponse.json({
                exists: true,
                source: 'local',
                data: {
                    name: localCustomer.name,
                    isBlocked: !!localCustomer.isBlocked,
                    isLead: !!localCustomer.isLead
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
                    isBlocked: false,
                    isLead: false
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
