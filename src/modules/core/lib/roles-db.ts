/**
 * @fileoverview Server-side functions for managing roles and permissions.
 * Separated to avoid circular dependencies.
 */
"use server";

import { connectDb } from './db';
import type { Role } from '../types';
import { initialRoles } from './db-constants';

/**
 * Retrieves all roles from the database.
 * Permissions are parsed from a JSON string into an array.
 * @returns {Promise<Role[]>}
 */
export async function getAllRoles(): Promise<Role[]> {
    const db = await connectDb();
    try {
        const roles = db.prepare('SELECT * FROM roles').all() as {id: string, name: string, permissions: string}[];
        const parsedRoles = roles.map(role => ({
            ...role,
            permissions: JSON.parse(role.permissions || '[]')
        }));
        return JSON.parse(JSON.stringify(parsedRoles));
    } catch (error) {
        console.error("Failed to get all roles:", error);
        return [];
    }
}

/**
 * Saves all roles to the database. This is a complete replacement.
 * @param {Role[]} roles - The array of roles to save.
 */
export async function saveAllRoles(roles: Role[]): Promise<void> {
    const db = await connectDb();
    const upsert = db.prepare(`
        INSERT INTO roles (id, name, permissions) 
        VALUES (@id, @name, @permissions)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            permissions = excluded.permissions
    `);
    
    const transaction = db.transaction((rolesToSave: Role[]) => {
        // Clear existing roles to handle deletions, but ALWAYS protect 'admin'
        const idsToKeep = rolesToSave.map(r => r.id);
        if (idsToKeep.length > 0) {
            const placeholders = idsToKeep.map(() => '?').join(',');
            db.prepare(`DELETE FROM roles WHERE id NOT IN (${placeholders}) AND id != 'admin'`).run(...idsToKeep);
        } else {
            db.prepare("DELETE FROM roles WHERE id != 'admin'").run();
        }

        for (const role of rolesToSave) {
            upsert.run({ ...role, permissions: JSON.stringify(role.permissions) });
        }
    });

    transaction(roles);
}

/**
 * Deletes a specific role by ID.
 * @param {string} id - The ID of the role to delete.
 */
export async function deleteRole(id: string): Promise<void> {
    if (id === 'admin') throw new Error("No se puede eliminar el rol de Administrador.");
    const db = await connectDb();
    db.prepare('DELETE FROM roles WHERE id = ?').run(id);
}

/**
 * Resets the default roles to their initial state.
 */
export async function resetDefaultRoles(): Promise<void> {
    const db = await connectDb();
    const upsert = db.prepare(`
        INSERT OR REPLACE INTO roles (id, name, permissions) 
        VALUES (@id, @name, @permissions)
    `);

    const transaction = db.transaction((defaultRoles: Role[]) => {
        for (const role of defaultRoles) {
            upsert.run({ ...role, permissions: JSON.stringify(role.permissions) });
        }
    });

    transaction(initialRoles);
}
