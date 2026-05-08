/**
 * @fileoverview API Endpoint for delivering signed marketing ads.
 * Implements segmentation by Software Name and License Type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActiveAdsForSoftware } from '@/modules/marketing/lib/db';
import { signLicenseData } from '@/modules/licenses/lib/crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const softwareName = searchParams.get('software');
        const status = searchParams.get('status') || 'all'; // 'free' or 'premium'

        if (!softwareName) {
            return NextResponse.json({ error: 'Software name is required' }, { status: 400 });
        }

        const ads = await getActiveAdsForSoftware(softwareName, status);

        // Sign the payload to ensure integrity
        const payload = {
            softwareName,
            status,
            ads,
            serverTimestamp: new Date().toISOString()
        };

        const signedData = await signLicenseData(payload);

        return NextResponse.json({
            success: true,
            payload: signedData
        });

    } catch (error: unknown) {
        console.error('Marketing API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
