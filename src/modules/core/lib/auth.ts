
/**
 * @fileoverview Server-side authentication using HttpOnly cookies and React cache.
 */
"use server";

import { cache } from 'react';
import { cookies } from 'next/headers';
import { connectDb } from './db';
import type { User, ExchangeRateApiResponse, Company, Customer, Contract } from '../types';
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
 * IMPROVED: Checks SMTP config first and only updates DB if email is sent successfully.
 */
export async function sendPasswordRecoveryEmail(email: string): Promise<void> {
    const db = await connectDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
    
    // Check if email settings are configured BEFORE doing anything
    const emailSettings = await getEmailSettings();
    if (!emailSettings.smtpHost) {
        await logError("Recovery failed: SMTP not configured", { email });
        throw new Error("El servicio de recuperación por correo no está configurado. Contacte a su administrador.");
    }

    if (!user) {
        await logWarn(`Password recovery requested for non-existent email: ${email}`);
        // Return success message to user anyway to prevent email enumeration
        return; 
    }

    try {
        const tempPassword = Math.random().toString(36).slice(-8);
        const companySettings = await getCompanySettings();

        // 1. Prepare email content
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

        // 2. ATTEMPT TO SEND EMAIL FIRST
        // If this fails, it throws an error and we never touch the DB
        await sendEmail({
            to: user.email,
            subject: emailSettings.recoveryEmailSubject || 'Recuperación de Contraseña - Clic-Soporte',
            html: body
        });

        // 3. ONLY IF EMAIL SUCCEEDED, UPDATE THE DATABASE
        const hashedTempPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);
        db.prepare('UPDATE users SET password = ?, forcePasswordChange = 1 WHERE id = ?')
          .run(hashedTempPassword, user.id);

        await logInfo(`Recovery email sent and password updated for ${user.name} (${email})`);
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to process password recovery for ${email}`, { error: err.message });
        throw new Error(`Error al enviar el correo: ${err.message}. Su contraseña actual sigue vigente.`);
    }
}

/**
 * Fetches all initial data for the AuthProvider in one go.
 * Enhanced to calculate consumed hours per customer for the current month.
 */
export async function getInitialAuthData() {
    try {
        const db = await connectDb();
        const [
            roles, companySettings, customersData, products, stock, exemptions, 
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

        // 1. Calculate Consumed Hours for this month per customer
        const consumptionRows = db.prepare(`
            SELECT 
                c.id as customerId,
                SUM(te.billableDuration) as consumedMs
            FROM time_entries te
            JOIN tickets t ON te.ticketId = t.id
            JOIN customers c ON (t.customerName = c.name OR t.companyName = c.name OR t.id = c.id)
            WHERE te.isBillable = 1 
              AND t.isBillable = 0 -- Only entries under contract/plan
              AND te.startTime >= date('now', 'start of month')
            GROUP BY c.id
        `).all() as { customerId: string, consumedMs: number }[];

        const consumptionMap = new Map(consumptionRows.map(r => [r.customerId, r.consumedMs / 3600000]));

        // 2. Fetch active contracts to determine available hours
        const activeContracts = db.prepare("SELECT * FROM contracts WHERE status = 'active'").all() as Contract[];
        const contractMap = new Map(activeContracts.map(c => [c.customerId, c.monthlyHours]));

        // 3. Enrich customers with hour data
        const enrichedCustomers = customersData.map(customer => {
            const consumedHours = consumptionMap.get(customer.id) || 0;
            
            // Priority for available hours: 1. Active Contract, 2. Assigned Support Package
            let availableHours = contractMap.get(customer.id) || 0;
            if (availableHours === 0 && customer.supportPackageId) {
                const pkg = companySettings.supportPackages.find(p => p.id === customer.supportPackageId);
                availableHours = pkg?.defaultHours || 0;
            }

            return {
                ...customer,
                consumedHours: parseFloat(consumedHours.toFixed(2)),
                availableHours
            };
        });

        const rateData: { rate: number | null; date: string | null } = { rate: null, date: null };
        const erRes = exchangeRate as ExchangeRateApiResponse | null;
        if (erRes?.venta?.valor) {
            rateData.rate = erRes.venta.valor;
            rateData.date = erRes.venta.fecha;
        }

        return {
            roles, 
            companySettings, 
            customers: enrichedCustomers, 
            products, 
            stock, 
            exemptions,
            exchangeRate: rateData, 
            unreadSuggestions, 
            users, 
            exemptionLaws: [] 
        };
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Critical error in getInitialAuthData:", err.message);
        return {
            roles: [], companySettings: {} as Company, customers: [], products: [], stock: [], exemptions: [],
            exchangeRate: { rate: null, date: null }, unreadSuggestions: 0, users: [], exemptionLaws: []
        };
    }
}
