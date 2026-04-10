'use server';

/**
 * @fileoverview Funciones de gestión de sesión del usuario.
 * Extraído a un archivo independiente para evitar dependencias circulares entre Auth y Data Access.
 */

import { cache } from 'react';
import { cookies } from 'next/headers';
import { connectDb } from './db';
import type { User } from '../types';
import { SESSION_COOKIE } from './auth-constants';

/**
 * Obtiene el usuario actualmente autenticado basado en la cookie de sesión.
 * Cacheado por petición para asegurar eficiencia en Server Components.
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
        console.error("Error al obtener usuario actual:", error);
        return null;
    }
});
