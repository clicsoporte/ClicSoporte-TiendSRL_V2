/**
 * @fileoverview Funciones guardianas para robustecer la autorización en el servidor.
 */
'use server';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './session';
import { connectDb } from './db';
import { checkPermissionInTree } from './permissions';
import { logWarn } from './logger';
import type { User } from '@/modules/core/types';

/**
 * Función memoizada para obtener el usuario actual desde la sesión.
 */
const getCachedUser = cache(async () => {
    return await getCurrentUser();
});

/**
 * Ayudante interno para verificar permisos de forma recursiva.
 */
async function checkPermission(permission: string): Promise<boolean> {
    const user = await getCachedUser();
    if (!user) return false;
    if (user.role === 'admin') return true;

    const db = await connectDb();
    const roleRow = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(user.role) as { permissions: string } | undefined;
    
    if (!roleRow) return false;
    
    const userPermissions: string[] = JSON.parse(roleRow.permissions || '[]');
    return checkPermissionInTree(userPermissions, permission);
}

/**
 * Exige sesión activa. Lanza error si no está autenticado.
 */
export async function authorizeSession(): Promise<User> {
    const user = await getCachedUser();
    if (!user) {
        await logWarn('Intento de acción sin autenticación o sesión expirada');
        throw new Error("No autenticado. Inicia sesión para continuar.");
    }
    return user;
}

/**
 * Verifica si el usuario tiene un permiso específico. Lanza error si falla.
 */
export async function authorizeAction(requiredPermission: string): Promise<User> {
    const user = await authorizeSession();
    const isAuthorized = await checkPermission(requiredPermission);

    if (!isAuthorized) {
        await logWarn(`Acceso Denegado: '${user.name}' intentó ejecutar acción sin permiso '${requiredPermission}'`);
        throw new Error(`Acceso Denegado: Se requiere el permiso "${requiredPermission}" para realizar esta acción.`);
    }

    return user;
}

/**
 * Verifica si el usuario tiene al menos uno de los permisos dados.
 */
export async function authorizeActionAny(requiredPermissions: string[]): Promise<User> {
    const user = await authorizeSession();
    
    if (user.role === 'admin') return user;

    for (const perm of requiredPermissions) {
        if (await checkPermission(perm)) {
            return user;
        }
    }

    await logWarn(`Acceso Denegado: '${user.name}' intentó ejecutar acción sin ninguno de los permisos requeridos`, { requiredPermissions });
    throw new Error("Acceso Denegado: No cuentas con los permisos requeridos.");
}

/**
 * Verifica si el usuario puede acceder a una página. Redirige si falla.
 */
export async function authorizePage(requiredPermission?: string): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
        return redirect('/');
    }
    
    if (requiredPermission) {
        const isAuthorized = await checkPermission(requiredPermission);
        if (!isAuthorized) {
            return redirect('/dashboard');
        }
    }
}

