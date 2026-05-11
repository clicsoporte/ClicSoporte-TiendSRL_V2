/**
 * @fileoverview Service for OTP (One-Time Password) generation, delivery and validation.
 * Reuses the generation logic from password recovery for consistency.
 */
"use server";

import { connectDb } from './db';
import { sendEmail } from './email-service';
import { getCompanySettings } from './settings-db';
import { logInfo, logError, logWarn } from './logger';

/**
 * Generates an 8-character random code (alphanumeric).
 * Matches the existing password recovery logic.
 */
function generateCode(): string {
    return Math.random().toString(36).slice(-8).toUpperCase();
}

/**
 * Requests an OTP code for a given email.
 * Marks any previous codes for this email as used.
 */
export async function requestOtp(email: string): Promise<boolean> {
    const db = await connectDb();
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

    try {
        const company = await getCompanySettings();
        
        // 1. Store in DB
        db.prepare(`
            INSERT INTO otp_verifications (email, code, expiresAt, isUsed)
            VALUES (?, ?, ?, 0)
        `).run(email, code, expiresAt);

        // 2. Send via Email
        const html = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
                <h2 style="color: #2563eb;">Verificación de Correo</h2>
                <p>Has solicitado el registro de una licencia gratuita para <b>${company.systemName || 'nuestro software'}</b>.</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Código de Validación</p>
                    <p style="margin: 5px 0; font-size: 32px; font-weight: 900; letter-spacing: 5px; color: #1e293b; font-family: monospace;">${code}</p>
                </div>
                <p style="font-size: 13px; color: #64748b;">Este código es válido por 30 minutos. Si no has solicitado este registro, puedes ignorar este mensaje.</p>
            </div>
        `;

        await sendEmail({
            to: email,
            subject: `Código de Verificación: ${code}`,
            html
        });

        await logInfo(`OTP code requested for ${email}`);
        return true;
    } catch (error: unknown) {
        logError("Failed to process OTP request", { error: (error as Error).message, email });
        return false;
    }
}

/**
 * Validates an OTP code.
 * If successful, deletes the record immediately (Hygienic Security).
 */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
    const db = await connectDb();
    const now = new Date().toISOString();

    const record = db.prepare(`
        SELECT * FROM otp_verifications 
        WHERE email = ? AND code = ? AND isUsed = 0 AND expiresAt > ?
        ORDER BY id DESC LIMIT 1
    `).get(email, code.toUpperCase(), now) as { id: number } | undefined;

    if (record) {
        // Delete immediately - One time use only!
        db.prepare('DELETE FROM otp_verifications WHERE id = ?').run(record.id);
        await logInfo(`OTP verified successfully for ${email}`);
        return true;
    }

    await logWarn(`Failed OTP attempt for ${email}`, { code });
    return false;
}
