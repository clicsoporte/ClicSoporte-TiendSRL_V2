/**
 * @fileoverview API Endpoint for delivering signed marketing ads.
 * Implements segmentation by Software Name and License Type.
 * Refactored for SDK v3.6: Returns structured JSON object to match activation endpoints.
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
        const dataToSign = {
            softwareName,
            status,
            ads,
            serverTimestamp: new Date().toISOString()
        };

        // signLicenseData returns a stringified JSON with { license_info, signature }
        const signedDataString = await signLicenseData(dataToSign);
        
        // Parse back to object so NextResponse sends it as pure JSON (not a double-quoted string)
        const structuredSignedData = JSON.parse(signedDataString);

        return NextResponse.json({
            success: true,
            payload: structuredSignedData
        });

    } catch (error: unknown) {
        console.error('Marketing API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
