/**
 * @fileoverview Service for OTP (One-Time Password) generation, delivery and validation.
 * Features rate-limiting, cryptographically secure code generation, and brute-force protection.
 */
"use server";

import crypto from 'crypto';
import { connectDb } from './db';
import { sendEmail } from './email-service';
import { getCompanySettings } from './settings-db';
import { logInfo, logError, logWarn } from './logger';
import { checkRateLimit, recordRateLimitFailure, resetRateLimit } from './rate-limiter';

/**
 * Generates an 8-character cryptographically secure alphanumeric code.
 */
function generateCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Requests an OTP code for a given email.
 * Includes cooldown period and rate limiting to prevent spam.
 */
export async function requestOtp(email: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const rateCheck = checkRateLimit(`request_otp:${normalizedEmail}`, 5, 30 * 60 * 1000);
    if (!rateCheck.allowed) {
        throw new Error(`Demasiadas solicitudes. Por favor espera ${Math.ceil(rateCheck.retryAfterSec / 60)} minutos.`);
    }

    const db = await connectDb();
    const now = new Date();

    // 1. Throttling Check (1 minute)
    const lastRequest = db.prepare(`
        SELECT expiresAt FROM otp_verifications 
        WHERE email = ? 
        ORDER BY id DESC LIMIT 1
    `).get(normalizedEmail) as { expiresAt: string } | undefined;

    if (lastRequest) {
        const lastRequestTime = new Date(new Date(lastRequest.expiresAt).getTime() - 30 * 60 * 1000);
        const diffSeconds = (now.getTime() - lastRequestTime.getTime()) / 1000;
        
        if (diffSeconds < 60) {
            await logWarn(`OTP request throttled for ${normalizedEmail}`, { secondsRemaining: Math.ceil(60 - diffSeconds) });
            throw new Error(`Por favor, espera ${Math.ceil(60 - diffSeconds)} segundos antes de solicitar un nuevo código.`);
        }
    }

    const code = generateCode();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 minutes

    try {
        const company = await getCompanySettings();
        
        // 2. Store in DB
        db.prepare(`
            INSERT INTO otp_verifications (email, code, expiresAt, isUsed)
            VALUES (?, ?, ?, 0)
        `).run(normalizedEmail, code, expiresAt);

        // 3. Send via Email
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
            to: normalizedEmail,
            subject: `Código de Verificación: ${code}`,
            html
        });

        await logInfo(`OTP code requested for ${normalizedEmail}`);
        return true;
    } catch (error: unknown) {
        logError("Failed to process OTP request", { error: (error as Error).message, email: normalizedEmail });
        throw error;
    }
}

/**
 * Validates an OTP code with brute-force lockout protection.
 * If successful, deletes the record immediately (Hygienic Security).
 */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const rateKey = `verify_otp:${normalizedEmail}`;

    const rateCheck = checkRateLimit(rateKey, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
        await logWarn(`Demasiados intentos fallidos de OTP para ${normalizedEmail}`);
        return false;
    }

    const db = await connectDb();
    const now = new Date().toISOString();

    const record = db.prepare(`
        SELECT * FROM otp_verifications 
        WHERE email = ? AND code = ? AND isUsed = 0 AND expiresAt > ?
        ORDER BY id DESC LIMIT 1
    `).get(normalizedEmail, code.toUpperCase(), now) as { id: number } | undefined;

    if (record) {
        resetRateLimit(rateKey);
        // Delete immediately - One time use only!
        db.prepare('DELETE FROM otp_verifications WHERE id = ?').run(record.id);
        await logInfo(`OTP verified successfully for ${normalizedEmail}`);
        return true;
    }

    recordRateLimitFailure(rateKey, 15 * 60 * 1000);
    await logWarn(`Failed OTP attempt for ${normalizedEmail}`, { code });
    return false;
}

