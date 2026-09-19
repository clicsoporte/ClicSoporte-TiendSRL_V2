/**
 * @fileoverview API Endpoint for registering free licenses with OTP validation.
 * Refactored for Production Blindado: Identity validation on re-installs and Dynamic Policies v3.8.
 * Updated for Auto-Migration v3.9.1: Supports 1-device limit and autonomous hardware transfer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { signLicenseData } from '@/modules/licenses/lib/crypto';
import { upsertLeadCustomer } from '@/modules/core/lib/data-access-db';
import { verifyOtp } from '@/modules/core/lib/otp-service';
import { logWarn, logInfo } from '@/modules/core/lib/logger';
import { triggerNotificationEvent } from '@/modules/notifications/lib/notifications-engine';
import type { Customer, License, SoftwareProduct } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Cuerpo de solicitud JSON no válido.' }, { status: 400 });
    }

    try {
        const { 
            softwareId, softwareName, hardwareId, 
            customerName, customerEmail, customerPhone, taxId, 
            otpCode, confirmTransfer 
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
        const isOtpValid = await verifyOtp(normalizedEmail, String(otpCode));
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

        // 5. CHECK FOR RE-INSTALLATION (Identity Shield)
        // Check if THIS specific hardware already has a license for THIS software
        const existingOnSameHardware = db.prepare(`
            SELECT l.*, c.email FROM licenses l
            JOIN customers c ON l.customerId = c.id
            WHERE l.softwareId = ? AND l.hardwareId = ? AND l.status = 'active'
        `).get(software.id, normalizedHardwareId) as (License & { email: string }) | undefined;

        if (existingOnSameHardware) {
            if (existingOnSameHardware.email !== normalizedEmail) {
                await logWarn(`Restauración Free denegada: Conflicto de correo`, { hwid: normalizedHardwareId, attempt: normalizedEmail, original: existingOnSameHardware.email });
                return NextResponse.json({ 
                    error: 'Este equipo ya está vinculado a una cuenta diferente. Use el correo original para restaurar o contacte a soporte.' 
                }, { status: 403 });
            }

            // If same hardware and same email, just return the existing license (Restoration)
            if (existingOnSameHardware.licenseKey) {
                try {
                    const existingFile = JSON.parse(existingOnSameHardware.licenseKey);
                    await logInfo(`Licencia Free restaurada con éxito para ${normalizedEmail}`, { hwid: normalizedHardwareId });
                    return NextResponse.json({ 
                        success: true, 
                        message: 'Restaurando licencia existente.',
                        license_file: existingFile 
                    });
                } catch {
                    return NextResponse.json({ success: true, license_file: existingOnSameHardware.licenseKey });
                }
            }
        }

        // 6. AUTO-MIGRATION LOGIC (1 Device Limit)
        // Check if the EMAIL already has a free license for THIS software on a DIFFERENT hardware
        const existingOnDifferentHardware = db.prepare(`
            SELECT l.id, l.hardwareId FROM licenses l
            JOIN customers c ON l.customerId = c.id
            WHERE l.softwareId = ? 
            AND c.email = ? 
            AND l.activationToken = 'FREE-LICENSE' 
            AND l.status = 'active'
            AND l.hardwareId != ?
        `).get(software.id, normalizedEmail, normalizedHardwareId) as { id: number, hardwareId: string } | undefined;

        if (existingOnDifferentHardware) {
            if (!confirmTransfer) {
                await logWarn(`Intento de registro múltiple detectado para ${normalizedEmail}`, { software: software.name });
                return NextResponse.json({ 
                    error: 'CONFLITO DE CUOTA: Ya posees una licencia gratuita activa en otro equipo. ¿Deseas desactivar el equipo anterior y transferir la licencia a este?',
                    requiresTransfer: true,
                    previousHardware: existingOnDifferentHardware.hardwareId
                }, { status: 409 });
            } else {
                // User confirmed transfer: Revoke the old one
                db.prepare("UPDATE licenses SET status = 'revoked' WHERE id = ?").run(existingOnDifferentHardware.id);
                await logInfo(`Licencia Free transferida para ${normalizedEmail}`, { software: software.name, from: existingOnDifferentHardware.hardwareId, to: normalizedHardwareId });
            }
        }

        // 7. Create the Customer as LEAD (Non-destructive)
        const customerData: Customer = {
            id: normalizedTaxId,
            name: String(customerName || 'Prospecto Nuevo').trim(),
            taxId: normalizedTaxId,
            email: normalizedEmail,
            phone: String(customerPhone || ''),
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

        // 8. Map 20 Modules for Free (Only m01 active by default)
        const modulesMap: Record<string, boolean> = {};
        for (let i = 1; i <= 20; i++) {
            const key = `m${String(i).padStart(2, '0')}`;
            modulesMap[key] = (i === 1); // Solo m01 activo para Free
        }

        // 9. Generate Signed Payload with Policies (v3.9.1)
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
            modules: modulesMap
        };

        const signedDataString = await signLicenseData(licenseInfo);
        const structuredLicenseFile = JSON.parse(signedDataString);

        // 10. Persist in DB with 20 columns support
        db.prepare(`
            INSERT INTO licenses (
                licenseKey, activationToken, softwareId, customerId, hardwareId, isPerpetual, expirationDate, status, createdAt, m01_val
            ) VALUES (?, 'FREE-LICENSE', ?, ?, ?, 1, '', 'active', ?, 1)
        `).run(signedDataString, software.id, customerData.id, normalizedHardwareId, now);

        const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };

        // 11. NOTIFICACIÓN DE NUEVO PROSPECTO (FREE)
        try {
            await triggerNotificationEvent('onLicenseAssigned', {
                id: lastId.id,
                customerId: customerData.id,
                customerName: customerData.name,
                softwareName: software.name,
                type: 'SaaS Propios',
                licenseStatus: confirmTransfer ? 'LICENCIA TRANSFERIDA (FREE)' : 'NUEVO PROSPECTO (FREE)',
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
        return NextResponse.json({ error: 'Solicitud no válida o error interno del servidor.' }, { status: 500 });
    }
}
