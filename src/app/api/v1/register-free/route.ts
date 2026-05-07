
/**
 * @fileoverview API Endpoint for registering free licenses.
 * Acts as a lead generator by creating a manual customer and a free license.
 * Optimized for SDK v2.6+ (uses Tax ID as primary identifier).
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

        // Validation: taxId is now required to prevent duplicates and maintain hierarchy
        if (!softwareId || !hardwareId || !customerName || !customerEmail || !taxId) {
            return NextResponse.json({ error: 'Faltan datos obligatorios para el registro (ID Fiscal/Cédula es requerido).' }, { status: 400 });
        }

        const db = await connectDb();

        // 1. Get Software Details for rich signing
        const software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(softwareId) as SoftwareProduct | undefined;
        
        if (!software) {
            return NextResponse.json({ error: 'El software especificado no existe en el catálogo central.' }, { status: 404 });
        }

        // 2. Create/Update a Manual Customer (Lead)
        // We use the taxId provided by the user as the primary 'id'
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

        // This function uses ON CONFLICT(id) DO UPDATE, so it handles duplicates automatically
        await upsertLeadCustomer(customerData);

        // 3. Check if a free license already exists for this hardware/software
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

        // 4. Create Free License Record with exact structure for SDK v2.6
        const now = new Date().toISOString();
        const licenseInfo = {
            softwareId: Number(softwareId),
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: customerData.id,
            hardwareId: hardwareId,
            activationToken: 'FREE-LICENSE',
            isPerpetual: true,
            expirationDate: '', // Important: empty string instead of null for RSA typing
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
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    }
}
