
/**
 * @fileoverview Lógica de autenticación del servidor.
 */
"use server";

import { cookies } from 'next/headers';
import { connectDb, getUnreadSuggestionsCount } from './db';
import type { User, ExchangeRateApiResponse, Company, Contract, Role, Customer } from '../types';
import bcrypt from 'bcryptjs';
import { logInfo, logWarn, logError } from './logger';
import { SESSION_COOKIE, SALT_ROUNDS, SESSION_DURATION } from './auth-constants';
import { getAllRoles } from './roles-db';
import { getCompanySettings } from './settings-db';
import { getAllCustomers, getAllProducts, getAllStock, getAllExemptions } from './data-access-db';
import { getExchangeRate } from './api-actions';
import { getEmailSettings, sendEmail } from './email-service';
import { getCurrentUser } from './session';

export { getCurrentUser };

/**
 * Intenta iniciar sesión para un usuario.
 * @returns El objeto de usuario y si se requiere cambio de contraseña.
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
                await logInfo(`Usuario '${user.name}' inició sesión exitosamente.`);
                return { 
                    user: JSON.parse(JSON.stringify(safeUser)), 
                    forcePasswordChange: !!user.forcePasswordChange 
                };
            }
        }
        await logWarn(`Intento de inicio de sesión fallido para: ${email}`);
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
    return JSON.parse(JSON.stringify(user));
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
 * Gestiona el proceso de recuperación de contraseña.
 */
export async function sendPasswordRecoveryEmail(email: string): Promise<void> {
    const db = await connectDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
    
    const emailSettings = await getEmailSettings();
    if (!emailSettings.smtpHost) {
        await logError("Recuperación fallida: SMTP no configurado", { email });
        throw new Error("El servicio de recuperación por correo no está configurado.");
    }

    if (!user) {
        await logWarn(`Recuperación solicitada para correo inexistente: ${email}`);
        return; 
    }

    try {
        const tempPassword = Math.random().toString(36).slice(-8);
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

        const hashedTempPassword = await bcrypt.hash(tempPassword, SALT_ROUNDS);
        db.prepare('UPDATE users SET password = ?, forcePasswordChange = 1 WHERE id = ?')
          .run(hashedTempPassword, user.id);

        await logInfo(`Correo de recuperación enviado para ${user.name}`);
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Fallo al procesar recuperación para ${email}`, { error: err.message });
        throw new Error(`Error al enviar el correo: ${err.message}`);
    }
}

/**
 * Obtiene todos los datos iniciales para el AuthProvider.
 * Actualizado con lógica de jerarquía de clientes para bolsa de horas compartida.
 */
export async function getInitialAuthData() {
    try {
        const db = await connectDb();
        const [
            roles, companySettings, customersData, products, stock, exemptions, 
            exchangeRate, unreadSuggestions, users
        ] = await Promise.all([
            getAllRoles().catch(() => [] as Role[]),
            getCompanySettings().catch(() => ({} as Company)),
            getAllCustomers().catch(() => []),
            getAllProducts().catch(() => []),
            getAllStock().catch(() => []),
            getAllExemptions().catch(() => []),
            getExchangeRate().catch(() => null),
            getUnreadSuggestionsCount().catch(() => 0),
            getAllUsers().catch(() => [])
        ]);

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
        const poolMap = new Map<string, number>(); // Root ID -> totalMs
        customersData.forEach((c: Customer) => {
            const raw = rawConsumptionMap.get(c.id) || 0;
            const rootId = c.parentCustomerId || c.id;
            poolMap.set(rootId, (poolMap.get(rootId) || 0) + raw);
        });

        const enrichedCustomers = customersData.map((customer: Customer) => {
            const rootId = customer.parentCustomerId || customer.id;
            
            // Consumo individual para la fila
            const consumedHours = (rawConsumptionMap.get(customer.id) || 0) / 3600000;
            
            // Horas disponibles: provienen del dueño del contrato (padre o el mismo si es root)
            const ownerId = customer.parentCustomerId || customer.id;
            let availableHours = contractMap.get(ownerId) || 0;
            
            if (availableHours === 0) {
                const owner = customersData.find(x => x.id === ownerId);
                if (owner?.supportPackageId) {
                    const pkg = companySettings.supportPackages.find(p => p.id === owner.supportPackageId);
                    availableHours = pkg?.defaultHours || 0;
                }
            }

            // El consumo total de la bolsa (para calcular saldo correctamente)
            const poolConsumedHours = (poolMap.get(rootId) || 0) / 3600000;

            return {
                ...customer,
                consumedHours: parseFloat(consumedHours.toFixed(2)),
                poolConsumedHours: parseFloat(poolConsumedHours.toFixed(2)),
                availableHours: availableHours
            };
        });

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
            exemptionLaws: [] 
        }));
    } catch (error: unknown) {
        const err = error as Error;
        console.error("Error crítico en getInitialAuthData:", err.message);
        return {
            roles: [], companySettings: {} as Company, customers: [], products: [], stock: [], exemptions: [],
            exchangeRate: { rate: null, date: null }, unreadSuggestions: 0, users: [], exemptionLaws: []
        };
    }
}
