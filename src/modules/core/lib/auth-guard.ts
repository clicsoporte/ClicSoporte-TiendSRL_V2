/**
 * @fileoverview Server-side guards to protect pages and actions based on user permissions.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { connectDb } from './db';
import type { Role } from '../types';

/**
 * Validates if the current user has a specific permission at the server level.
 * Handles the hierarchical check (admin:all or parent permissions).
 */
async function checkPermission(permission: string): Promise<boolean> {
    const user = await getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;

    const db = await connectDb();
    const roleRow = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(user.role) as { permissions: string } | undefined;
    
    if (!roleRow) return false;
    
    const permissions: string[] = JSON.parse(roleRow.permissions || '[]');
    
    // Check direct permission or super admin
    if (permissions.includes(permission) || permissions.includes('admin:all')) return true;
    
    return false;
}

/**
 * Protects a Server Component (Page). Redirects to dashboard if unauthorized.
 */
export async function authorizePage(permission?: string) {
    const user = await getCurrentUser();
    if (!user) redirect('/');
    
    if (permission) {
        const authorized = await checkPermission(permission);
        if (!authorized) redirect('/dashboard');
    }
}

/**
 * Protects a Server Action. Throws error if unauthorized.
 */
export async function authorizeAction(permission: string) {
    const authorized = await checkPermission(permission);
    if (!authorized) {
        throw new Error(`Acceso Denegado: Se requiere el permiso ${permission}`);
    }
}
