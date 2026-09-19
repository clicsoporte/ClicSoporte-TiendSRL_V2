/**
 * @fileoverview Lógica de autenticación del servidor.
 */
"use server";

import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { connectDb, getUnreadSuggestionsCount } from './db';
import type { User, ExchangeRateApiResponse, Company, Contract, Role, SoftwareProduct, Customer } from '../types';
import bcrypt from 'bcryptjs';
import { logInfo, logWarn, logError } from './logger';
import { SESSION_COOKIE, SALT_ROUNDS, SESSION_DURATION } from './auth-constants';
import { getAllRoles } from './roles-db';
import { getCompanySettings } from './settings-db';
import { getAllCustomers, getAllProducts, getAllStock, getAllExemptions } from './data-access-db';
import { getExchangeRate } from './api-actions';
import { getEmailSettings, sendEmail } from './email-service';
import { getCurrentUser } from './session';
import { generateSessionToken } from './jwt-service';
import { checkRateLimit, recordRateLimitFailure, resetRateLimit } from './rate-limiter';
import { authorizeAction, authorizeSession } from './auth-guard';

// Direct export of the cached session function
export { getCurrentUser };

/**
 * Intenta iniciar sesión para un usuario con protección contra ataques de fuerza bruta.
 * @returns El objeto de usuario y si se requiere cambio de contraseña.
 */
export async function login(email: string, passwordProvided: string): Promise<{ user: User | null, forcePasswordChange: boolean, error?: string }> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const clientIp = headers().get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const rateLimitKey = `login:${normalizedEmail}:${clientIp}`;
    const ipRateLimitKey = `login_ip:${clientIp}`;

    // Global IP limit (max 20 failed attempts per 15 min per IP)
    const ipLimit = checkRateLimit(ipRateLimitKey, 20, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
        await logWarn(`Demasiados intentos de login desde la IP: ${clientIp}`);
        return {
            user: null,
            forcePasswordChange: false,
            error: `Demasiados intentos fallidos desde su ubicación. Intente de nuevo en ${Math.ceil(ipLimit.retryAfterSec / 60)} minutos.`
        };
    }

    // Account + IP limit (5 attempts per 15 min)
    const rateLimit = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
        await logWarn(`Bloqueo por fuerza bruta para usuario: ${normalizedEmail} (IP: ${clientIp})`);
        return { 
            user: null, 
            forcePasswordChange: false, 
            error: `Demasiados intentos fallidos para esta cuenta. Intente de nuevo en ${Math.ceil(rateLimit.retryAfterSec / 60)} minutos.` 
        };
    }

    const db = await connectDb();
    try {
        const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as User | undefined;

        if (user && user.password) {
            const isMatch = await bcrypt.compare(passwordProvided, user.password);
            if (isMatch) {
                resetRateLimit(rateLimitKey);
                resetRateLimit(ipRateLimitKey);

                // Sincronizado a 8 horas exactas (SESSION_DURATION en segundos / 86400 días)
                const sessionToken = generateSessionToken({
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                    name: user.name,
                    expiresInDays: SESSION_DURATION / (24 * 60 * 60)
                });

                const isHttps = headers().get('x-forwarded-proto') === 'https' || headers().get('referer')?.startsWith('https://');

                cookies().set(SESSION_COOKIE, sessionToken, {
                    httpOnly: true,
                    secure: isHttps,
                    sameSite: 'lax',
                    maxAge: SESSION_DURATION,
                    path: '/',
                });

                const safeUser = { ...user };
                delete safeUser.password;
                await logInfo(`Usuario '${user.name}' inició sesión exitosamente.`);
                return { 
                    user: JSON.parse(JSON.stringify(safeUser)), 
                    forcePasswordChange: !!user.forcePasswordChange 
                };
            }
        }

        recordRateLimitFailure(rateLimitKey, 15 * 60 * 1000);
        recordRateLimitFailure(ipRateLimitKey, 15 * 60 * 1000);
        await logWarn(`Intento de inicio de sesión fallido para: ${normalizedEmail} desde IP: ${clientIp}`);
        return { user: null, forcePasswordChange: false };
    } catch (error) {
        console.error("Error en login:", error);
        return { user: null, forcePasswordChange: false };
    }
}

export async function logout(): Promise<void> {
    const user = await getCurrentUser();
    if (user) await logInfo(`Usuario '${user.name}' cerró sesión.`);
    cookies().delete(SESSION_COOKIE);
}

export async function getAllUsers(): Promise<User[]> {
    await authorizeAction('admin:users');
    const db = await connectDb();
    const rows = db.prepare('SELECT id, name, email, phone, whatsapp, role, avatar, forcePasswordChange, recentActivity FROM users ORDER BY name').all() as User[];
    return JSON.parse(JSON.stringify(rows));
}

export async function addUser(userData: Omit<User, 'id'> & { password: string }): Promise<User> {
    await authorizeAction('admin:users');
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
    const currentUser = await authorizeSession();
    
    // Si no es admin, solo puede actualizar su propio perfil (y no puede cambiar su propio rol a admin)
    if (currentUser.role !== 'admin') {
        if (currentUser.id !== user.id) {
            throw new Error("Acceso Denegado: No tienes permiso para editar otros usuarios.");
        }
        user.role = currentUser.role; // Prevenir escalada de privilegios
    }

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
    return JSON.parse(JSON.stringify(user));
}

export async function deleteUser(id: number): Promise<void> {
    await authorizeAction('admin:users');
    const db = await connectDb();
    if (id === 1) throw new Error("No se puede eliminar al admin principal.");
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export async function comparePasswords(userId: number, password: string): Promise<boolean> {
    const currentUser = await authorizeSession();
    if (currentUser.role !== 'admin' && currentUser.id !== userId) {
        return false;
    }
    const db = await connectDb();
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as { password?: string };
    if (!user?.password) return false;
    return await bcrypt.compare(password, user.password);
}

/**
 * Gestiona el proceso de recuperación de contraseña con rate-limiting y generación criptográfica segura.
 */
export async function sendPasswordRecoveryEmail(email: string): Promise<void> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const rateKey = `recovery:${normalizedEmail}`;
    
    const rateCheck = checkRateLimit(rateKey, 3, 30 * 60 * 1000);
    if (!rateCheck.allowed) {
        throw new Error(`Demasiadas solicitudes de recuperación. Intenta nuevamente en ${Math.ceil(rateCheck.retryAfterSec / 60)} minutos.`);
    }
    recordRateLimitFailure(rateKey, 30 * 60 * 1000);

    const db = await connectDb();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as User | undefined;
    
    const emailSettings = await getEmailSettings();
    if (!emailSettings.smtpHost) {
        await logError("Recuperación fallida: SMTP no configurado", { email: normalizedEmail });
        throw new Error("El servicio de recuperación por correo no está configurado.");
    }

    if (!user) {
        await logWarn(`Recuperación solicitada para correo inexistente: ${normalizedEmail}`);
        return; 
    }

    try {
        // Generación de contraseña aleatoria criptográficamente segura
        const tempPassword = crypto.randomBytes(5).toString('hex').toUpperCase();
        const companySettings = await getCompanySettings();

        let body = (emailSettings.recoveryEmailBody || `
            <div style="font-family: sans-serif;">
                <h2>Hola [NOMBRE_USUARIO]</h2>
                <p>Has solicitado restablecer tu contraseña.</p>
                <p>Tu clave temporal es: <b style="font-size: 18px; color: #2563eb;">[CLAVE_TEMPORAL]</b></p>
                <p>El sistema te pedirá cambiarla al ingresar.</p>
            </div>
        `)
        .replace('[NOMBRE_USUARIO]', user.name)
        .replace('[CLAVE_TEMPORAL]', tempPassword);

        if (companySettings.name) {
            body += `<p style="margin-top: 20px; font-size: 12px; color: #666;">Enviado por: ${companySettings.name}</p>`;
        }

        await sendEmail({
            to: user.email,
            subject: emailSettings.recoveryEmailSubject || 'Recuperación de Contraseña',
            html: body
        });

        const hashedPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);
        db.prepare('UPDATE users SET password = ?, forcePasswordChange = 1 WHERE id = ?')
          .run(hashedPassword, user.id);

        await logInfo(`Correo de recuperación enviado para ${user.name}`);
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Fallo al procesar recuperación para ${normalizedEmail}`, { error: err.message });
        throw new Error(`Error al enviar el correo: ${err.message}`);
    }
}

/**
 * Obtiene todos los datos iniciales para el AuthProvider.
 * Protegido y contextualizado para el usuario en sesión.
 */
export async function getInitialAuthData() {
    try {
        const currentUser = await getCurrentUser();
        const db = await connectDb();

        const [
            roles, companySettings, customersData, products, stock, exemptions, 
            exchangeRate, unreadSuggestions
        ] = await Promise.all([
            getAllRoles().catch(() => [] as Role[]),
            getCompanySettings().catch(() => ({} as Company)),
            getAllCustomers().catch(() => []),
            getAllProducts().catch(() => []),
            getAllStock().catch(() => []),
            getAllExemptions().catch(() => []),
            getExchangeRate().catch(() => null),
            getUnreadSuggestionsCount().catch(() => 0)
        ]);

        // Lista de usuarios solo para administradores
        let users: User[] = [];
        if (currentUser?.role === 'admin') {
            const rows = db.prepare('SELECT id, name, email, phone, whatsapp, role, avatar, forcePasswordChange, recentActivity FROM users ORDER BY name').all() as User[];
            users = JSON.parse(JSON.stringify(rows));
        } else if (currentUser) {
            users = [currentUser];
        }

        // 1. Obtener consumo individual de este mes
        const consumptionRows = db.prepare(`
            SELECT 
                c.id as customerId,
                SUM(te.billableDuration) as consumedMs
            FROM time_entries te
            JOIN tickets t ON te.ticketId = t.id
            JOIN customers c ON (t.customerName = c.name OR t.companyName = c.name OR t.id = c.id)
            WHERE te.isBillable = 1 
              AND t.isBillable = 0
              AND te.startTime >= date('now', 'start of month')
            GROUP BY c.id
        `).all() as { customerId: string, consumedMs: number }[];

        const rawConsumptionMap = new Map(consumptionRows.map(r => [r.customerId, r.consumedMs]));
        
        // 2. Obtener contratos vigentes
        const activeContracts = db.prepare("SELECT * FROM contracts WHERE status = 'active'").all() as Contract[];
        const contractMap = new Map(activeContracts.map(c => [c.customerId, c.monthlyHours]));

        // 3. Consolidar consumo por jerarquía (Pool Global)
        const poolMap = new Map<string, number>();
        customersData.forEach((c: Customer) => {
            const raw = rawConsumptionMap.get(c.id) || 0;
            const rootId = c.parentCustomerId || c.id;
            poolMap.set(rootId, (poolMap.get(rootId) || 0) + raw);
        });

        const enrichedCustomers = customersData.map((customer: Customer) => {
            const rootId = customer.parentCustomerId || customer.id;
            const consumedHours = (rawConsumptionMap.get(customer.id) || 0) / 3600000;
            const ownerId = customer.parentCustomerId || customer.id;
            let availableHours = contractMap.get(ownerId) || 0;
            
            if (availableHours === 0) {
                const owner = customersData.find((x: Customer) => x.id === ownerId);
                if (owner?.supportPackageId) {
                    const pkg = companySettings.supportPackages?.find(p => p.id === owner.supportPackageId);
                    availableHours = pkg?.defaultHours || 0;
                }
            }

            const poolConsumedHours = (poolMap.get(rootId) || 0) / 3600000;

            return {
                ...customer,
                consumedHours: parseFloat(consumedHours.toFixed(2)),
                poolConsumedHours: parseFloat(poolConsumedHours.toFixed(2)),
                availableHours: availableHours
            };
        });

        // 4. Fetch software products
        const softwareProducts = db.prepare('SELECT * FROM software_products ORDER BY name').all() as SoftwareProduct[];

        const rateData: { rate: number | null; date: string | null } = { rate: null, date: null };
        const erRes = exchangeRate as ExchangeRateApiResponse | null;
        if (erRes?.venta?.valor) {
            rateData.rate = erRes.venta.valor;
            rateData.date = erRes.venta.fecha;
        }

        return JSON.parse(JSON.stringify({
            roles, 
            companySettings, 
            customers: enrichedCustomers, 
            products, 
            stock, 
            exemptions,
            exchangeRate: rateData, 
            unreadSuggestions, 
            users, 
            softwareProducts,
            exemptionLaws: [] 
        }));
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Error crítico en getInitialAuthData:", err.message);
        return {
            roles: [], companySettings: {} as Company, customers: [], products: [], stock: [], exemptions: [],
            exchangeRate: { rate: null, date: null }, unreadSuggestions: 0, users: [], softwareProducts: [], exemptionLaws: []
        };
    }
}

