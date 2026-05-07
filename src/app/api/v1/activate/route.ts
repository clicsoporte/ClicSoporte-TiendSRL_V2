
/**
 * @fileoverview API Endpoint for child software activation.
 * Handles the linking between an activation token and a hardware ID.
 * Enhanced with same-hardware re-activation support.
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

        // 2. CHECK FOR RE-INSTALLATION ON SAME HARDWARE
        // If the license is already bound to this hardwareId, just return the signed file
        if (license.hardwareId === hardwareId && license.licenseKey) {
            return NextResponse.json({
                success: true,
                license_file: license.licenseKey
            });
        }

        // 3. CHECK FOR MULTI-PC ATTEMPT
        // If already bound to DIFFERENT hardware, reject
        if (license.hardwareId && license.hardwareId !== hardwareId) {
            return NextResponse.json({ error: 'Esta licencia ya está vinculada a otro equipo. Contacte a soporte técnico para transferirla.' }, { status: 403 });
        }

        // 4. Bind hardwareId if not already set (First time activation)
        if (!license.hardwareId) {
            db.prepare('UPDATE licenses SET hardwareId = ? WHERE id = ?').run(hardwareId, license.id);
        }

        // 5. Get software details for the payload
        const software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(softwareId) as SoftwareProduct;

        // 6. Generate signed payload with standard structure v2.6
        const licenseInfo = {
            softwareId: software.id,
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: license.customerId,
            hardwareId: hardwareId,
            activationToken: activationToken,
            isPerpetual: !!license.isPerpetual,
            expirationDate: license.expirationDate || '',
            status: 'active',
            createdAt: license.createdAt,
            modules: {
                m01: !!license.m01_val, m02: !!license.m02_val, m03: !!license.m03_val, m04: !!license.m04_val, m05: !!license.m05_val,
                m06: !!license.m06_val, m07: !!license.m07_val, m08: !!license.m08_val, m09: !!license.m09_val, m10: !!license.m10_val
            }
        };

        const signedData = await signLicenseData(licenseInfo);

        // Update stored licenseKey to cache the signed result
        db.prepare('UPDATE licenses SET licenseKey = ? WHERE id = ?').run(signedData, license.id);

        return NextResponse.json({
            success: true,
            license_file: signedData
        });

    } catch (error: unknown) {
        console.error('Activation API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
