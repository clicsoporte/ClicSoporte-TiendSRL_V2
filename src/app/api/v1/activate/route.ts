
/**
 * @fileoverview API Endpoint for child software activation.
 * Handles the linking between an activation token and a hardware ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { signLicenseData } from '@/modules/licenses/lib/crypto';
import type { License, SoftwareProduct } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { softwareId, activationToken, hardwareId } = body;

        if (!softwareId || !activationToken || !hardwareId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const db = await connectDb();

        // 1. Find the license by token and software
        const license = db.prepare(`
            SELECT * FROM licenses 
            WHERE softwareId = ? AND activationToken = ? AND status = 'active'
        `).get(softwareId, activationToken) as License | undefined;

        if (!license) {
            return NextResponse.json({ error: 'Licencia no válida o token inexistente.' }, { status: 404 });
        }

        // 2. Check if hardwareId matches or needs to be bound
        if (license.hardwareId && license.hardwareId !== hardwareId) {
            return NextResponse.json({ error: 'Esta licencia ya está vinculada a otro equipo.' }, { status: 403 });
        }

        // 3. Bind hardwareId if not already set
        if (!license.hardwareId) {
            db.prepare('UPDATE licenses SET hardwareId = ? WHERE id = ?').run(hardwareId, license.id);
        }

        // 4. Get software details for the payload
        const software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(softwareId) as SoftwareProduct;

        // 5. Generate signed payload
        const licenseInfo = {
            softwareId: software.id,
            softwareName: software.name,
            customerId: license.customerId,
            hardwareId: hardwareId,
            activationToken: activationToken,
            isPerpetual: !!license.isPerpetual,
            expirationDate: license.expirationDate,
            createdAt: license.createdAt,
            modules: {
                m01: !!license.m01_val, m02: !!license.m02_val, m03: !!license.m03_val, m04: !!license.m04_val, m05: !!license.m05_val,
                m06: !!license.m06_val, m07: !!license.m07_val, m08: !!license.m08_val, m09: !!license.m09_val, m10: !!license.m10_val
            }
        };

        const signedData = await signLicenseData(licenseInfo);

        return NextResponse.json({
            success: true,
            license_file: signedData
        });

    } catch (error: any) {
        console.error('Activation API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
