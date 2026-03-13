/**
 * @fileoverview Server-side authentication using HttpOnly cookies and React cache.
 */
"use server";

import { cache } from 'react';
import { cookies } from 'next/headers';
import { connectDb } from './db';
import type { User, ExchangeRateApiResponse, Company } from '../types';
import bcrypt from 'bcryptjs';
import { logInfo, logWarn, logError } from './logger';
import { SESSION_COOKIE, SALT_ROUNDS, SESSION_DURATION } from './auth-constants';
import { getAllRoles } from './roles-db';
import { getCompanySettings } from './settings-db';
import { getAllCustomers, getAllProducts, getAllStock, getAllExemptions } from './data-access-db';
import { getExchangeRate } from './api-actions';
import { getUnreadSuggestionsCount } from './suggestions-actions';
import { getEmailSettings, sendEmail } from './email-service';

/**
 * Retrieves the currently authenticated user based on the session cookie.
 * Cached per request to ensure efficiency.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
    const cookieStore = cookies();
    const userId = cookieStore.get(SESSION_COOKIE)?.value;

    if (!userId) return null;

    try {
        const db = await connectDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId)) as User | undefined;

        if (!user) return null;

        const safeUser = { ...user };
        delete safeUser.password;
        return JSON.parse(JSON.stringify(safeUser));
    } catch (error) {
        console.error("Error fetching current user:", error);
        return null;
    }
});

/**
 * Attempts to log in a user.
 * @returns The user object and whether a password change is required.
 */
export async function login(email: string, passwordProvided: string): Promise<{ user: User | null, forcePasswordChange: boolean }> {
    const db = await connectDb();
    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;

        if (user && user.password) {
            const isMatch = await bcrypt.compare(passwordProvided, user.password);
            if (isMatch) {
                cookies().set(SESSION_COOKIE, String(user.id), {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: SESSION_DURATION,
                    path: '/',
                });

                const safeUser = { ...user };
                delete safeUser.password;
                await logInfo(`User '${user.name}' logged in successfully.`);
                return { 
                    user: JSON.parse(JSON.stringify(safeUser)), 
                    forcePasswordChange: !!user.forcePasswordChange 
                };
            }
        }
        await logWarn(`Failed login attempt for email: ${email}`);
        return { user: null, forcePasswordChange: false };
    } catch (error) {
        console.error("Login error:", error);
        return { user: null, forcePasswordChange: false };
    }
}

export async function logout(): Promise<void> {
    const user = await getCurrentUser();
    if (user) await logInfo(`User '${user.name}' logged out.`);
    cookies().delete(SESSION_COOKIE);
}

export async function getAllUsers(): Promise<User[]> {
    const db = await connectDb();
    const rows = db.prepare('SELECT id, name, email, phone, whatsapp, role, avatar, forcePasswordChange, recentActivity FROM users ORDER BY name').all() as User[];
    return JSON.parse(JSON.stringify(rows));
}

export async function addUser(userData: Omit<User, 'id'> & { password: string }): Promise<User> {
    const db = await connectDb();
    const hashedPassword = bcrypt.hashSync(userData.password, SALT_ROUNDS);
    
    const info = db.prepare(`
        INSERT INTO users (name, email, password, phone, whatsapp, role, forcePasswordChange, avatar, recentActivity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        userData.name, 
        userData.email, 
        hashedPassword, 
        userData.phone || '', 
        userData.whatsapp || '', 
        userData.role, 
        userData.forcePasswordChange ? 1 : 0,
        userData.avatar || '',
        userData.recentActivity || 'Usuario recién creado.'
    );

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as User;
    const safeUser = { ...newUser };
    delete safeUser.password;
    return JSON.parse(JSON.stringify(safeUser));
}

export async function updateUser(user: User): Promise<User> {
    const db = await connectDb();
    let query = 'UPDATE users SET name = ?, email = ?, phone = ?, whatsapp = ?, role = ?, forcePasswordChange = ?, avatar = ?, recentActivity = ?';
    const params: (string | number | null | boolean)[] = [
        user.name, 
        user.email, 
        user.phone || '', 
        user.whatsapp || '', 
        user.role, 
        user.forcePasswordChange ? 1 : 0,
        user.avatar || '',
        user.recentActivity || ''
    ];

    if (user.password) {
        query += ', password = ?';
        params.push(bcrypt.hashSync(user.password, SALT_ROUNDS));
    }

    query += ' WHERE id = ?';
    params.push(user.id);

    db.prepare(query).run(...params);
    return user;
}

export async function deleteUser(id: number): Promise<void> {
    const db = await connectDb();
    if (id === 1) throw new Error("No se puede eliminar al admin principal.");
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export async function comparePasswords(userId: number, password: string): Promise<boolean> {
    const db = await connectDb();
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as { password?: string };
    if (!user?.password) return false;
    return await bcrypt.compare(password, user.password);
}

/**
 * Handles the password recovery process by generating a temporary password and emailing it.
 */
export async function sendPasswordRecoveryEmail(email: string): Promise<void> {
    const db = await connectDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
    
    if (!user) {
        await logWarn(`Password recovery requested for non-existent email: ${email}`);
        return; // Silent return for security to prevent email enumeration
    }

    try {
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedTempPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);

        db.prepare('UPDATE users SET password = ?, forcePasswordChange = 1 WHERE id = ?')
          .run(hashedTempPassword, user.id);

        const emailSettings = await getEmailSettings();
        const companySettings = await getCompanySettings();

        if (!emailSettings.smtpHost) {
            throw new Error("SMTP service is not configured. Cannot send recovery email.");
        }

        let body = (emailSettings.recoveryEmailBody || `
            <div style="font-family: sans-serif;">
                <h2>Hola [NOMBRE_USUARIO]</h2>
                <p>Has solicitado restablecer tu contraseña en Clic-Soporte.</p>
                <p>Tu clave temporal es: <b style="font-size: 18px; color: #2563eb;">[CLAVE_TEMPORAL]</b></p>
                <p>Por seguridad, el sistema te pedirá cambiar esta clave al ingresar.</p>
            </div>
        `)
        .replace('[NOMBRE_USUARIO]', user.name)
        .replace('[CLAVE_TEMPORAL]', tempPassword);

        if (companySettings.name) {
            body += `<p style="margin-top: 20px; font-size: 12px; color: #666;">Enviado por: ${companySettings.name}</p>`;
        }

        await sendEmail({
            to: user.email,
            subject: emailSettings.recoveryEmailSubject || 'Recuperación de Contraseña - Clic-Soporte',
            html: body
        });

        await logInfo(`Recovery email sent to ${user.name} (${email})`);
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to process password recovery for ${email}`, { error: err.message });
        throw new Error("No se pudo procesar la recuperación. Contacte al administrador.");
    }
}

/**
 * Fetches all initial data for the AuthProvider in one go.
 */
export async function getInitialAuthData() {
    try {
        const [
            roles, companySettings, customers, products, stock, exemptions, 
            exchangeRate, unreadSuggestions, users
        ] = await Promise.all([
            getAllRoles().catch(() => []),
            getCompanySettings().catch(() => ({} as Company)),
            getAllCustomers().catch(() => []),
            getAllProducts().catch(() => []),
            getAllStock().catch(() => []),
            getAllExemptions().catch(() => []),
            getExchangeRate().catch(() => null),
            getUnreadSuggestionsCount().catch(() => 0),
            getAllUsers().catch(() => [])
        ]);

        const rateData: { rate: number | null; date: string | null } = { rate: null, date: null };
        const erRes = exchangeRate as ExchangeRateApiResponse | null;
        if (erRes?.venta?.valor) {
            rateData.rate = erRes.venta.valor;
            rateData.date = erRes.venta.fecha;
        }

        return {
            roles, companySettings, customers, products, stock, exemptions,
            exchangeRate: rateData, unreadSuggestions, users, exemptionLaws: [] 
        };
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Critical error in getInitialAuthData:", err.message);
        // Return minimal defaults to prevent complete app crash
        return {
            roles: [], companySettings: {} as Company, customers: [], products: [], stock: [], exemptions: [],
            exchangeRate: { rate: null, date: null }, unreadSuggestions: 0, users: [], exemptionLaws: []
        };
    }
}
