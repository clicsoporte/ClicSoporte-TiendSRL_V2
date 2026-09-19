/**
 * @fileoverview API Endpoint for client verification and autocomplete.
 * Refactored for Production Blindado: Strict TaxID normalization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { getContributorInfo } from '@/modules/hacienda/lib/actions';
import { checkRateLimit, recordRateLimitFailure } from '@/modules/core/lib/rate-limiter';
import type { Customer } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
        const rateLimitKey = `verify_client_ip:${clientIp}`;

        // Rate limit: 30 requests per minute per IP
        const rateCheck = checkRateLimit(rateLimitKey, 30, 60 * 1000);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { error: 'Límite de consultas excedido. Intente de nuevo en un minuto.' },
                { status: 429 }
            );
        }

        const { searchParams } = new URL(req.url);
        const rawTaxId = searchParams.get('taxId');

        if (!rawTaxId) {
            recordRateLimitFailure(rateLimitKey, 60 * 1000);
            return NextResponse.json({ error: 'Tax ID is required' }, { status: 400 });
        }

        // Normalización y validación estricta
        const taxId = rawTaxId.trim().toUpperCase();
        if (!/^[a-zA-Z0-9-]{8,25}$/.test(taxId)) {
            recordRateLimitFailure(rateLimitKey, 60 * 1000);
            return NextResponse.json({ error: 'Invalid Tax ID format' }, { status: 400 });
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
