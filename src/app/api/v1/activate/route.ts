/**
 * @fileoverview API Endpoint for child software activation.
 * Refactored for Production Blindado: Strict Multi-PC protection and Collision checks.
 * Includes support contact information and Server Logs for fraud detection.
 * Updated for M20 Expansion: Supports 20 logical modules.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import { signLicenseData } from '@/modules/licenses/lib/crypto';
import { logWarn } from '@/modules/core/lib/logger';
import type { SoftwareProduct, Customer } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

const CONTACT_INFO = "Favor contactar a Soporte Técnico: soporte@clicsoporte.com o WhatsApp +50640000630";

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
            return NextResponse.json({ error: `El software '${softwareName || softwareId}' no está registrado en nuestra central.` }, { status: 404 });
        }

        // 2. CHECK FOR HARDWARE COLLISION (Duplicate PC protection)
        const otherLicense = db.prepare(`
            SELECT id, activationToken FROM licenses 
            WHERE softwareId = ? 
            AND hardwareId = ? 
            AND status = 'active' 
            AND activationToken != ?
        `).get(software.id, normalizedHardwareId, normalizedToken) as { id: number, activationToken: string } | undefined;

        if (otherLicense) {
            await logWarn(`Colisión de Hardware: Equipo ya tiene licencia activa`, { hwid: normalizedHardwareId, software: software.name, existingToken: otherLicense.activationToken });
            return NextResponse.json({ 
                error: `OPERACIÓN DENEGADA: Este equipo ya cuenta con una licencia activa para este software (${otherLicense.activationToken}). ${CONTACT_INFO}` 
            }, { status: 409 });
        }

        // 3. Find requested license
        const license = db.prepare(`
            SELECT * FROM licenses 
            WHERE softwareId = ? AND activationToken = ? AND status = 'active'
        `).get(software.id, normalizedToken) as Record<string, string | number | null>;

        if (!license) {
            return NextResponse.json({ error: `Licencia no válida o token inexistente. ${CONTACT_INFO}` }, { status: 404 });
        }

        // 4. CHECK FOR MULTI-PC ATTEMPT (Hardware Lock)
        if (license.hardwareId && license.hardwareId !== normalizedHardwareId) {
            await logWarn(`Intento de uso Multi-PC bloqueado`, { token: normalizedToken, originalHwid: license.hardwareId as string, intruderHwid: normalizedHardwareId, software: software.name });
            return NextResponse.json({ 
                error: `OPERACIÓN DENEGADA: Esta licencia ya está vinculada a otro equipo y no puede ser transferida automáticamente. ${CONTACT_INFO}` 
            }, { status: 403 });
        }

        // 5. Bind hardwareId if not set (First-time activation)
        if (!license.hardwareId) {
            db.prepare('UPDATE licenses SET hardwareId = ? WHERE id = ?').run(normalizedHardwareId, license.id);
        }

        // 6. Resolve Customer for Identity Injection
        const customer = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(license.customerId) as Pick<Customer, 'name' | 'email' | 'phone'> | undefined;

        // 7. Map 20 Modules status
        const modulesMap: Record<string, boolean> = {};
        for (let i = 1; i <= 20; i++) {
            const key = `m${String(i).padStart(2, '0')}`;
            modulesMap[key] = license[`${key}_val`] === 1;
        }

        // 8. Generate signed payload with Policies (v3.9)
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
            isPerpetual: license.isPerpetual === 1,
            expirationDate: license.expirationDate || '',
            status: 'active',
            createdAt: license.createdAt,
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

        db.prepare('UPDATE licenses SET licenseKey = ? WHERE id = ?').run(signedDataString, license.id);

        return NextResponse.json({
            success: true,
            license_file: structuredLicenseFile
        });

    } catch (error: unknown) {
        console.error('Activation API Error:', error);
        return NextResponse.json({ error: 'Error interno del servidor. Intente más tarde.' }, { status: 500 });
    }
}
