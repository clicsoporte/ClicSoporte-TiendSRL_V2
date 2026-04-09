/**
 * @fileoverview Hook for hierarchical permission checking.
 */
'use client';

import { useAuth } from './useAuth';
import { permissionTree } from '../lib/permissions';

export function useAuthorization(requiredPermissions: string[] = []) {
  const { userRole, isAuthReady } = useAuth();

  const hasPermission = (permission: string): boolean => {
    if (!userRole) return false;
    if (userRole.id === 'admin') return true;

    const userPerms = userRole.permissions || [];
    if (userPerms.includes(permission) || userPerms.includes('admin:all')) return true;

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

    return searchInTree(userPerms);
  };

  const isAuthorized = requiredPermissions.length === 0 
    ? true 
    : requiredPermissions.some(p => hasPermission(p));

  return { 
    isAuthorized: isAuthReady ? isAuthorized : null, 
    hasPermission,
    isLoading: !isAuthReady 
  };
}
