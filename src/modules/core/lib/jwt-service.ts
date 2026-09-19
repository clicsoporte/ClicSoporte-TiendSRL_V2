import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

export interface SessionTokenPayload {
    userId: number;
    email: string;
    role: string;
    name?: string;
    iat: number;
    exp: number;
}

// Clave en memoria caché para evitar lecturas de disco continuas
let _cachedDbJwtSecret: string | null = null;

/**
 * Obtiene o inicializa la clave secreta para la firma de sesiones.
 * Prioridad:
 * 1. Variable de entorno SESSION_SECRET / JWT_SECRET / NEXTAUTH_SECRET.
 * 2. Secreto persistido en SQLite (dbs/intratool.db) para sobrevivir reinicios.
 * 3. Fallback generado aleatoriamente.
 */
export function getSecretKey(): string {
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
        return process.env.SESSION_SECRET.trim();
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
        return process.env.JWT_SECRET.trim();
    }
    if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.trim().length >= 16) {
        return process.env.NEXTAUTH_SECRET.trim();
    }

    if (_cachedDbJwtSecret) {
        return _cachedDbJwtSecret;
    }

    // Persistencia en SQLite para asegurar estabilidad entre reinicios
    try {
        const dbDir = path.join(process.cwd(), 'dbs');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        const dbPath = path.join(dbDir, 'intratool.db');
        const db = new Database(dbPath);

        
        db.exec("CREATE TABLE IF NOT EXISTS system_secrets (key TEXT PRIMARY KEY, value TEXT)");
        const row = db.prepare("SELECT value FROM system_secrets WHERE key = 'system_session_secret'").get() as { value?: string } | undefined;
        
        if (row && row.value && row.value.length >= 32) {
            _cachedDbJwtSecret = row.value;
            db.close();
            return _cachedDbJwtSecret!;
        }

        const generated = crypto.randomBytes(64).toString('hex');
        db.prepare("INSERT INTO system_secrets (key, value) VALUES ('system_session_secret', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(generated, generated);
        _cachedDbJwtSecret = generated;
        db.close();
        return _cachedDbJwtSecret!;
    } catch (err) {
        console.warn("No se pudo persistir secret en BD, usando memoria:", err);
        if (!_cachedDbJwtSecret) {
            _cachedDbJwtSecret = crypto.randomBytes(64).toString('hex');
        }
        return _cachedDbJwtSecret;
    }
}

function base64UrlEncode(str: string): string {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Genera un token firmado HMAC-SHA256 (JWT estándar) válido para sesión.
 */
export function generateSessionToken(payload: {
    userId: number;
    email: string;
    role: string;
    name?: string;
    expiresInDays?: number;
}): string {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const expDays = payload.expiresInDays || 7;
    const exp = now + (expDays * 24 * 60 * 60);

    const fullPayload: SessionTokenPayload = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        name: payload.name || '',
        iat: now,
        exp: exp
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

    const signature = crypto
        .createHmac('sha256', getSecretKey())
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Valida la firma criptográfica y expiración de un token de sesión.
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
    try {
        if (!token || typeof token !== 'string') return null;
        const parts = token.trim().split('.');
        if (parts.length !== 3) return null;

        const [encodedHeader, encodedPayload, signature] = parts;

        const expectedSignature = crypto
            .createHmac('sha256', getSecretKey())
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');

        const sigBuffer = Buffer.from(signature);
        const expSigBuffer = Buffer.from(expectedSignature);

        if (sigBuffer.length !== expSigBuffer.length) {
            return null;
        }

        // Comparación resistente a timing attacks
        if (!crypto.timingSafeEqual(sigBuffer, expSigBuffer)) {
            return null;
        }

        const payloadStr = base64UrlDecode(encodedPayload);
        const payload: SessionTokenPayload = JSON.parse(payloadStr);

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return null; // Token expirado
        }

        return payload;
    } catch {
        return null;
    }
}
