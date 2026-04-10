/**
 * @fileoverview Server-side "guardian" functions for robust authorization.
 * These functions are the primary source of truth for permission checking on the server,
 * protecting both API-like actions and page renders.
 */
'use server';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { connectDb } from './db';
import { checkPermissionInTree } from './permissions';
import type { User } from '@/modules/core/types';

/**
 * Memoized function to get the current user's data from the session.
 */
const getCachedUser = cache(async () => {
    return await getCurrentUser();
});

/**
 * Internal helper to verify permission recursively.
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
 * Verifies if the current user in session has a specific permission.
 * Throws an Error if the check fails. Primary guard for all Server Actions.
 *
 * @param requiredPermission The permission string to check for.
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
 * Verifies if the current user in session can access a specific page.
 * If the check fails, it redirects the user to the main dashboard.
 *
 * @param requiredPermission The permission string to check for.
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
