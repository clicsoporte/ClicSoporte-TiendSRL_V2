/**
 * @fileoverview API Endpoint for registering free licenses.
 * Acts as a lead generator by creating a manual customer and a free license.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { signLicenseData } from '@/modules/licenses/lib/crypto';
import { upsertCustomer } from '@/modules/core/lib/data-access-db';
import type { Customer, License } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { softwareId, hardwareId, customerName, customerEmail, customerPhone } = body;

        if (!softwareId || !hardwareId || !customerName || !customerEmail) {
            return NextResponse.json({ error: 'Faltan datos obligatorios para el registro.' }, { status: 400 });
        }

        const db = await connectDb();

        // 1. Create/Update a Manual Customer (Lead)
        // We use the email as a temporary ID prefix if no ID is provided
        const tempId = `LEAD-${customerEmail.split('@')[0].toUpperCase()}`;
        
        const customerData: Customer = {
            id: tempId,
            name: customerName,
            taxId: 'GENERICO',
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

        await upsertCustomer(customerData);

        // 2. Check if a free license already exists for this hardware/software
        const existing = db.prepare(`
            SELECT * FROM licenses 
            WHERE softwareId = ? AND hardwareId = ? AND status = 'active'
        `).get(softwareId, hardwareId) as License | undefined;

        if (existing) {
            return NextResponse.json({ 
                success: true, 
                message: 'Ya existe una licencia registrada para este equipo.',
                license_file: existing.licenseKey 
            });
        }

        // 3. Create Free License Record
        const now = new Date().toISOString();
        const licenseInfo = {
            softwareId: Number(softwareId),
            softwareName: 'Software Registrado', // Will be enriched by child
            customerId: tempId,
            hardwareId: hardwareId,
            activationToken: 'FREE-LICENSE',
            isPerpetual: true,
            expirationDate: null,
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
                licenseKey, activationToken, softwareId, customerId, hardwareId, isPerpetual, status, createdAt, m01_val
            ) VALUES (?, 'FREE-LICENSE', ?, ?, ?, 1, 'active', ?, 1)
        `).run(signedData, softwareId, tempId, hardwareId, now);

        return NextResponse.json({
            success: true,
            license_file: signedData
        });

    } catch (error: unknown) {
        console.error('Free Registration API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
