/**
 * @fileoverview Server-side guards to protect pages and actions based on user permissions.
 */
import { redirect } from 'next/navigation';
import { getCurrentUser } from './auth';
import { connectDb } from './db';
import { permissionTree } from './permissions';

/**
 * Validates if the current user has a specific permission at the server level.
 * Handles recursive hierarchical checks.
 */
async function checkPermission(permission: string): Promise<boolean> {
    const user = await getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;

    const db = await connectDb();
    const roleRow = db.prepare('SELECT permissions FROM roles WHERE id = ?').get(user.role) as { permissions: string } | undefined;
    
    if (!roleRow) return false;
    
    const userPermissions: string[] = JSON.parse(roleRow.permissions || '[]');
    
    if (userPermissions.includes('admin:all')) return true;
    if (userPermissions.includes(permission)) return true;

    // Recursive search in permission tree
    const memo = new Set<string>();
    const searchInTree = (perms: string[]): boolean => {
        for (const p of perms) {
            if (p === permission) return true;
            if (memo.has(p)) continue;
            memo.add(p);
            
            const children = permissionTree[p] || [];
            if (children.includes(permission)) return true;
            if (searchInTree(children)) return true;
        }
        return false;
    };

    return searchInTree(userPermissions);
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
