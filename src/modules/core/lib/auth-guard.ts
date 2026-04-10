/**
 * @fileoverview Funciones guardianas para robustecer la autorización en el servidor.
 */
'use server';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './session';
import { connectDb } from './db';
import { checkPermissionInTree } from './permissions';
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
 * Verifica si el usuario tiene un permiso específico. Lanza error si falla.
 */
export async function authorizeAction(requiredPermission: string): Promise<User> {
    const user = await getCachedUser();
    if (!user) {
        throw new Error("No autenticado. Inicia sesión para continuar.");
    }
    
    const isAuthorized = await checkPermission(requiredPermission);

    if (!isAuthorized) {
        throw new Error(`Acceso Denegado: Se requiere el permiso "${requiredPermission}" para realizar esta acción.`);
    }

    return user;
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
