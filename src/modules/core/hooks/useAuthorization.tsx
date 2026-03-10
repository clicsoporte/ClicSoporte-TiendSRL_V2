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

    // Hierarchical check: does any of the user's permissions have this as a child?
    for (const userPerm of userPerms) {
      const children = permissionTree[userPerm] || [];
      if (children.includes(permission)) return true;
    }

    return false;
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
