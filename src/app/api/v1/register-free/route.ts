/**
 * @fileoverview API Endpoint for registering free licenses with OTP validation.
 * Refactored for Production Blindado: Strict Dynamic Policies v3.8.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { signLicenseData } from '@/modules/licenses/lib/crypto';
import { upsertLeadCustomer } from '@/modules/core/lib/data-access-db';
import { verifyOtp } from '@/modules/core/lib/otp-service';
import { triggerNotificationEvent } from '@/modules/notifications/lib/notifications-engine';
import type { Customer, License, SoftwareProduct } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { 
            softwareId, softwareName, hardwareId, 
            customerName, customerEmail, customerPhone, taxId, 
            otpCode 
        } = body;

        // 1. Handshake Validation
        if (!otpCode) {
            return NextResponse.json({ error: 'Validación requerida: Ingrese el código OTP enviado a su correo.' }, { status: 403 });
        }

        // 2. Strict Normalization (Producción)
        const normalizedEmail = String(customerEmail || '').trim().toLowerCase();
        const normalizedTaxId = String(taxId || '').trim().toUpperCase();
        const normalizedHardwareId = String(hardwareId || '').trim();

        if ((!softwareId && !softwareName) || !normalizedHardwareId || !normalizedTaxId || !normalizedEmail) {
            return NextResponse.json({ error: 'Faltan identificadores obligatorios (Software, HardwareID, Email o TaxID)' }, { status: 400 });
        }

        // 3. Verify OTP
        const isOtpValid = await verifyOtp(normalizedEmail, otpCode);
        if (!isOtpValid) {
            return NextResponse.json({ error: 'Código OTP inválido o expirado. Solicite uno nuevo.' }, { status: 401 });
        }

        const db = await connectDb();

        // 4. Resolve Software
        let software: SoftwareProduct | undefined;
        if (softwareId) {
            software = db.prepare('SELECT * FROM software_products WHERE id = ?').get(softwareId) as SoftwareProduct | undefined;
        } else if (softwareName) {
            software = db.prepare('SELECT * FROM software_products WHERE name = ?').get(softwareName) as SoftwareProduct | undefined;
        }

        if (!software) {
            return NextResponse.json({ error: `El software '${softwareName || softwareId}' no está registrado.` }, { status: 404 });
        }

        // 5. CHECK FOR RE-INSTALLATION (Self-healing)
        const existingLicense = db.prepare(`
            SELECT * FROM licenses 
            WHERE softwareId = ? AND hardwareId = ? AND status = 'active'
        `).get(software.id, normalizedHardwareId) as License | undefined;

        if (existingLicense && existingLicense.licenseKey) {
            try {
                const existingFile = JSON.parse(existingLicense.licenseKey);
                return NextResponse.json({ 
                    success: true, 
                    message: 'Restaurando licencia existente.',
                    license_file: existingFile 
                });
            } catch {
                return NextResponse.json({ success: true, license_file: existingLicense.licenseKey });
            }
        }

        // 6. Create the Customer as LEAD (Non-destructive)
        const customerData: Customer = {
            id: normalizedTaxId,
            name: String(customerName || 'Prospecto Nuevo').trim(),
            taxId: normalizedTaxId,
            email: normalizedEmail,
            phone: customerPhone || '',
            active: 'S',
            address: 'Registro Online (Lead OTP)',
            contacts: [],
            currency: 'CRC',
            creditLimit: 0,
            paymentCondition: '0',
            salesperson: 'SISTEMA ONLINE',
            electronicDocEmail: normalizedEmail,
            isManual: true,
            isLead: true 
        };

        await upsertLeadCustomer(customerData);

        // 7. Generate Signed Payload with Policies (v3.8)
        const now = new Date().toISOString();
        const licenseInfo = {
            softwareId: software.id,
            softwareName: software.name,
            softwareVersion: software.currentVersion || '1.0.0',
            customerId: customerData.id,
            customerName: customerData.name,
            customerEmail: customerData.email,
            customerPhone: customerData.phone,
            hardwareId: normalizedHardwareId,
            activationToken: 'FREE-LICENSE',
            isPerpetual: true,
            status: 'active',
            createdAt: now,
            policies: {
                syncFrequencyFree: software.syncFrequencyFree || 7,
                adRefreshFrequency: software.adRefreshFrequency || 2,
                nagScreenTimer: software.nagScreenTimer || 60,
                allowOfflinePremium: !!software.allowOfflinePremium
            },
            modules: {
                m01: true, m02: false, m03: false, m04: false, m05: false,
                m06: false, m07: false, m08: false, m09: false, m10: false
            }
        };

        const signedDataString = await signLicenseData(licenseInfo);
        const structuredLicenseFile = JSON.parse(signedDataString);

        const info = db.prepare(`
            INSERT INTO licenses (
                licenseKey, activationToken, softwareId, customerId, hardwareId, isPerpetual, expirationDate, status, createdAt, m01_val
            ) VALUES (?, 'FREE-LICENSE', ?, ?, ?, 1, '', 'active', ?, 1)
        `).run(signedDataString, software.id, customerData.id, normalizedHardwareId, now);

        // 8. NOTIFICACIÓN DE NUEVO PROSPECTO (FREE)
        try {
            await triggerNotificationEvent('onLicenseAssigned', {
                id: Number(info.lastInsertRowid),
                customerId: customerData.id,
                customerName: customerData.name,
                softwareName: software.name,
                type: 'SaaS Propios',
                licenseStatus: 'NUEVO PROSPECTO (FREE)',
                expirationDate: 'Perpetua (Demo)',
                hardwareId: normalizedHardwareId
            });
        } catch (notifErr) {
            console.error("Fallo al enviar notificación de registro Free:", notifErr);
        }

        return NextResponse.json({
            success: true,
            license_file: structuredLicenseFile
        });

    } catch (error: unknown) {
        console.error('Free OTP Registration Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
