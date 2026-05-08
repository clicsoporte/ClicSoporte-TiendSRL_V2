
/**
 * @fileoverview API Endpoint for child software activation.
 * Handles the linking between an activation token and a hardware ID.
 * Enhanced with software identification by Name and Identity injection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { signLicenseData } from '@/modules/licenses/lib/crypto';
import type { License, SoftwareProduct, Customer } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { softwareId, softwareName, activationToken, hardwareId } = body;

        if ((!softwareId && !softwareName) || !activationToken || !hardwareId) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios (Software, Token o HardwareID)' }, { status: 400 });
        }

        const db = await connectDb();

        // 1. Resolve Software
        let software: SoftwareProduct | undefined;
        if (softwareId) {
            software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(softwareId) as SoftwareProduct | undefined;
        } else if (softwareName) {
            software = db.prepare('SELECT * FROM software_products WHERE name = ?').get(softwareName) as SoftwareProduct | undefined;
        }

        if (!software) {
            return NextResponse.json({ error: `El software '${softwareName || softwareId}' no está registrado en el sistema.` }, { status: 404 });
        }

        // 2. Find the license by token and software
        const license = db.prepare(`
            SELECT * FROM licenses 
            WHERE softwareId = ? AND activationToken = ? AND status = 'active'
        `).get(software.id, activationToken) as License | undefined;

        if (!license) {
            return NextResponse.json({ error: 'Licencia no válida o token inexistente para este producto.' }, { status: 404 });
        }

        // 3. Resolve Customer Master Data for Identity Injection
        const customer = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(license.customerId) as Pick<Customer, 'name' | 'email' | 'phone'> | undefined;

        // 4. CHECK FOR RE-INSTALLATION ON SAME HARDWARE
        if (license.hardwareId === hardwareId && license.licenseKey) {
            return NextResponse.json({
                success: true,
                license_file: license.licenseKey
            });
        }

        // 5. CHECK FOR MULTI-PC ATTEMPT
        if (license.hardwareId && license.hardwareId !== hardwareId) {
            return NextResponse.json({ error: 'Esta licencia ya está vinculada a otro equipo.' }, { status: 403 });
        }

        // 6. Bind hardwareId if not already set
        if (!license.hardwareId) {
            db.prepare('UPDATE licenses SET hardwareId = ? WHERE id = ?').run(hardwareId, license.id);
        }

        // 7. Generate signed payload with Master Identity
        const licenseInfo = {
            softwareId: software.id,
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: license.customerId,
            customerName: customer?.name || '',
            customerEmail: customer?.email || '',
            customerPhone: customer?.phone || '',
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

        // Cache signed result
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
