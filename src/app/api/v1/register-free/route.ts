
/**
 * @fileoverview API Endpoint for registering free licenses.
 * Refactored for SDK v3.3: Returns structured JSON object and ensures master identity injection.
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
        const { softwareId, softwareName, hardwareId, customerName, customerEmail, customerPhone, taxId } = body;

        // 1. Basic validation (Identifiers are always mandatory)
        if ((!softwareId && !softwareName) || !hardwareId || !taxId) {
            return NextResponse.json({ error: 'Faltan identificadores obligatorios (Software, HardwareID o TaxID)' }, { status: 400 });
        }

        const db = await connectDb();

        // 2. Resolve Software
        let software: SoftwareProduct | undefined;
        if (softwareId) {
            software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(softwareId) as SoftwareProduct | undefined;
        } else if (softwareName) {
            software = db.prepare('SELECT * FROM software_products WHERE name = ?').get(softwareName) as SoftwareProduct | undefined;
        }

        if (!software) {
            return NextResponse.json({ error: `El software '${softwareName || softwareId}' no está registrado en el catálogo.` }, { status: 404 });
        }

        // 3. CHECK IF CUSTOMER EXISTS
        const existingCustomer = db.prepare('SELECT * FROM customers WHERE id = ? OR taxId = ?').get(taxId, taxId) as Customer | undefined;

        // 4. Conditional Validation: Contact info is ONLY mandatory for NEW customers
        if (!existingCustomer) {
            if (!customerName || !customerEmail) {
                return NextResponse.json({ error: 'Faltan datos obligatorios para el registro de nuevo cliente (Nombre y Email).' }, { status: 400 });
            }
        }

        // 5. CHECK FOR RE-INSTALLATION ON SAME HARDWARE
        const existingLicense = db.prepare(`
            SELECT * FROM licenses 
            WHERE softwareId = ? AND hardwareId = ? AND status = 'active'
        `).get(software.id, hardwareId) as License | undefined;

        if (existingLicense && existingLicense.licenseKey) {
            try {
                const existingFile = JSON.parse(existingLicense.licenseKey);
                return NextResponse.json({ 
                    success: true, 
                    message: 'Restaurando licencia existente para este hardware.',
                    license_file: existingFile 
                });
            } catch {
                return NextResponse.json({ 
                    success: true, 
                    message: 'Restaurando licencia existente para este hardware.',
                    license_file: existingLicense.licenseKey 
                });
            }
        }

        // 6. Ensure/Create the Customer (Protects existing data internally)
        const customerData: Customer = {
            id: taxId.trim().toUpperCase(),
            name: customerName || (existingCustomer?.name || 'Cliente Nuevo'),
            taxId: taxId.trim().toUpperCase(),
            email: customerEmail || (existingCustomer?.email || ''),
            phone: customerPhone || (existingCustomer?.phone || ''),
            active: 'S',
            address: existingCustomer?.address || 'Registro Online (Lead)',
            contacts: [],
            currency: 'CRC',
            creditLimit: 0,
            paymentCondition: '0',
            salesperson: 'SISTEMA ONLINE',
            electronicDocEmail: customerEmail || (existingCustomer?.electronicDocEmail || ''),
            isManual: true
        };

        await upsertLeadCustomer(customerData);

        // 7. Create Free License Record with Identity Injection
        const now = new Date().toISOString();
        const licenseInfo = {
            softwareId: software.id,
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: customerData.id,
            customerName: customerData.name,
            customerEmail: customerData.email,
            customerPhone: customerData.phone,
            hardwareId: hardwareId,
            activationToken: 'FREE-LICENSE',
            isPerpetual: true,
            expirationDate: '',
            status: 'active',
            createdAt: now,
            modules: {
                m01: true, m02: false, m03: false, m04: false, m05: false,
                m06: false, m07: false, m08: false, m09: false, m10: false
            }
        };

        const signedDataString = await signLicenseData(licenseInfo);
        const structuredLicenseFile = JSON.parse(signedDataString);

        db.prepare(`
            INSERT INTO licenses (
                licenseKey, activationToken, softwareId, customerId, hardwareId, isPerpetual, expirationDate, status, createdAt, m01_val
            ) VALUES (?, 'FREE-LICENSE', ?, ?, ?, 1, '', 'active', ?, 1)
        `).run(signedDataString, software.id, customerData.id, hardwareId, now);

        return NextResponse.json({
            success: true,
            license_file: structuredLicenseFile
        });

    } catch (error: unknown) {
        console.error('Free Registration API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
