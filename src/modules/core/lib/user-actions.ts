
'use server';

/**
 * @fileoverview Server actions for user management, including the setup wizard.
 */

import { connectDb, getUserCount } from './db';
import bcrypt from 'bcryptjs';
import { initialRoles } from './db-constants';
import { logInfo, logError } from './logger';

const SALT_ROUNDS = 10;

/**
 * Creates the first administrator user during the initial setup wizard.
 * Only works if the database has zero users.
 */
export async function createFirstUser(userData: { name: string; email: string; password: string }) {
    const currentCount = await getUserCount();
    
    if (currentCount > 0) {
        throw new Error("El asistente de configuración solo está disponible para el primer arranque.");
    }

    try {
        const db = await connectDb();
        const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);
        
        const info = db.prepare(`
            INSERT INTO users (name, email, password, role, forcePasswordChange, recentActivity)
            VALUES (?, ?, ?, 'admin', 0, 'Primer administrador creado mediante el asistente.')
        `).run(userData.name, userData.email, hashedPassword);

        await logInfo(`Asistente de Configuración: Primer administrador creado (${userData.email}).`);
        return { success: true, userId: Number(info.lastInsertRowid) };
    } catch (error: unknown) {
        const err = error as Error;
        await logError("Falla crítica al crear primer usuario", { error: err.message });
        throw new Error("No se pudo completar la configuración inicial.");
    }
}
