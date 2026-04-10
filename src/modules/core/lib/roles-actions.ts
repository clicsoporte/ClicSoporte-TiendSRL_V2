'use server';

/**
 * @fileoverview Server Actions for the Roles Management module.
 * Unified interface for UI interaction with the permissions database.
 */

import {
    getAllRoles as getAllRolesDb,
    saveAllRoles as saveAllRolesDb,
    resetDefaultRoles as resetDefaultRolesDb,
} from './roles-db';
import type { Role } from '../types';
import { authorizeAction } from './auth-guard';

/**
 * Retrieves all roles from the database.
 * Requires roles:read permission.
 */
export async function getAllRoles(): Promise<Role[]> {
    await authorizeAction('roles:read');
    return await getAllRolesDb();
}

/**
 * Saves the entire set of roles.
 * Requires roles:update permission.
 */
export async function saveAllRoles(roles: Role[]): Promise<void> {
    await authorizeAction('roles:update');
    return await saveAllRolesDb(roles);
}

/**
 * Resets the roles to the system's default set.
 * Requires roles:update permission.
 */
export async function resetDefaultRoles(): Promise<void> {
    await authorizeAction('roles:update');
    return await resetDefaultRolesDb();
}
