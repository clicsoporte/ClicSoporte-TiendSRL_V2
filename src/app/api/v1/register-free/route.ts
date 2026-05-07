
/**
 * @fileoverview API Endpoint for registering free licenses.
 * Optimized for re-installations and duplicate detection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { signLicenseData } from '@/modules/licenses/lib/crypto';
import { upsertLeadCustomer } from '@/modules/core/lib/data-access-db';
import type { Customer, License, SoftwareProduct } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { softwareId, hardwareId, customerName, customerEmail, customerPhone, taxId } = body;

        if (!softwareId || !hardwareId || !customerName || !customerEmail || !taxId) {
            return NextResponse.json({ error: 'Faltan datos obligatorios para el registro.' }, { status: 400 });
        }

        const db = await connectDb();

        // 1. Get Software Details
        const software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(softwareId) as SoftwareProduct | undefined;
        if (!software) return NextResponse.json({ error: 'El software especificado no existe.' }, { status: 404 });

        // 2. CHECK FOR RE-INSTALLATION
        // If this specific PC already has a license for this software, return it immediately
        const existingLicense = db.prepare(`
            SELECT * FROM licenses 
            WHERE softwareId = ? AND hardwareId = ? AND status = 'active'
        `).get(softwareId, hardwareId) as License | undefined;

        if (existingLicense && existingLicense.licenseKey) {
            return NextResponse.json({ 
                success: true, 
                message: 'Bienvenido de nuevo. Restaurando licencia existente.',
                license_file: existingLicense.licenseKey 
            });
        }

        // 3. Ensure/Create the Customer (Protects existing data)
        const customerData: Customer = {
            id: taxId.trim().toUpperCase(),
            name: customerName,
            taxId: taxId.trim().toUpperCase(),
            email: customerEmail,
            phone: customerPhone || '',
            active: 'S',
            address: 'Registro Online (Free)',
            contacts: [],
            currency: 'CRC',
            creditLimit: 0,
            paymentCondition: '0',
            salesperson: 'SISTEMA ONLINE',
            electronicDocEmail: customerEmail,
            isManual: true
        };

        await upsertLeadCustomer(customerData);

        // 4. Create Free License Record
        const now = new Date().toISOString();
        const licenseInfo = {
            softwareId: Number(softwareId),
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: customerData.id,
            hardwareId: hardwareId,
            activationToken: 'FREE-LICENSE',
            isPerpetual: true,
            expirationDate: '',
            status: 'FREE_MODE',
            createdAt: now,
            modules: {
                m01: true, m02: false, m03: false, m04: false, m05: false,
                m06: false, m07: false, m08: false, m09: false, m10: false
            }
        };

        const signedData = await signLicenseData(licenseInfo);

        db.prepare(`
            INSERT INTO licenses (
                licenseKey, activationToken, softwareId, customerId, hardwareId, isPerpetual, expirationDate, status, createdAt, m01_val
            ) VALUES (?, 'FREE-LICENSE', ?, ?, ?, 1, '', 'active', ?, 1)
        `).run(signedData, softwareId, customerData.id, hardwareId, now);

        return NextResponse.json({
            success: true,
            license_file: signedData
        });

    } catch (error: unknown) {
        console.error('Free Registration API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
