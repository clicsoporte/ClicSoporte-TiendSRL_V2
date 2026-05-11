/**
 * @fileoverview API Endpoint for child software activation.
 * Refactored for Production Blindado: Strict ID normalization.
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

        // Normalización forzada
        const normalizedHardwareId = String(hardwareId || '').trim();
        const normalizedToken = String(activationToken || '').trim().toUpperCase();

        if ((!softwareId && !softwareName) || !normalizedToken || !normalizedHardwareId) {
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
            return NextResponse.json({ error: `El software '${softwareName || softwareId}' no está registrado.` }, { status: 404 });
        }

        // 2. CHECK FOR HARDWARE COLLISION
        const otherLicense = db.prepare(`
            SELECT id, activationToken FROM licenses 
            WHERE softwareId = ? 
            AND hardwareId = ? 
            AND status = 'active' 
            AND activationToken != ?
        `).get(software.id, normalizedHardwareId, normalizedToken) as { id: number, activationToken: string } | undefined;

        if (otherLicense) {
            return NextResponse.json({ 
                error: `OPERACIÓN DENEGADA: Este equipo ya cuenta con una licencia activa para este software (${otherLicense.activationToken}).` 
            }, { status: 409 });
        }

        // 3. Find requested license
        const license = db.prepare(`
            SELECT * FROM licenses 
            WHERE softwareId = ? AND activationToken = ? AND status = 'active'
        `).get(software.id, normalizedToken) as License | undefined;

        if (!license) {
            return NextResponse.json({ error: 'Licencia no válida o token inexistente.' }, { status: 404 });
        }

        // 4. CHECK FOR MULTI-PC ATTEMPT
        if (license.hardwareId && license.hardwareId !== normalizedHardwareId) {
            return NextResponse.json({ error: 'Esta licencia ya está vinculada a otro equipo.' }, { status: 403 });
        }

        // 5. Bind hardwareId if not set
        if (!license.hardwareId) {
            db.prepare('UPDATE licenses SET hardwareId = ? WHERE id = ?').run(normalizedHardwareId, license.id);
        }

        // 6. Resolve Customer for Identity Injection
        const customer = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(license.customerId) as Pick<Customer, 'name' | 'email' | 'phone'> | undefined;

        // 7. Generate signed payload
        const licenseInfo = {
            softwareId: software.id,
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: license.customerId,
            customerName: customer?.name || '',
            customerEmail: customer?.email || '',
            customerPhone: customer?.phone || '',
            hardwareId: normalizedHardwareId,
            activationToken: normalizedToken,
            isPerpetual: !!license.isPerpetual,
            expirationDate: license.expirationDate || '',
            status: 'active',
            createdAt: license.createdAt,
            modules: {
                m01: !!license.m01_val, m02: !!license.m02_val, m03: !!license.m03_val, m04: !!license.m04_val, m05: !!license.m05_val,
                m06: !!license.m06_val, m07: !!license.m07_val, m08: !!license.m08_val, m09: !!license.m09_val, m10: !!license.m10_val
            }
        };

        const signedDataString = await signLicenseData(licenseInfo);
        const structuredLicenseFile = JSON.parse(signedDataString);

        db.prepare('UPDATE licenses SET licenseKey = ? WHERE id = ?').run(signedDataString, license.id);

        return NextResponse.json({
            success: true,
            license_file: structuredLicenseFile
        });

    } catch (error: unknown) {
        console.error('Activation API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
