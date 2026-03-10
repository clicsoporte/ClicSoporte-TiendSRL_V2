/**
 * @fileoverview Client-side functions for interacting with server-side authentication logic.
 */
'use client';

import type { User } from '@/modules/core/types';
import { 
    getAllUsers as getAllUsersServer, 
    login as loginServer, 
    updateUser as updateUserServer,
    deleteUser as deleteUserServer,
    comparePasswords as comparePasswordsServer, 
    addUser as addUserServer, 
    logout as logoutServer,
    getCurrentUser as getCurrentUserServer
} from './auth';

/**
 * Logs in a user.
 */
export async function login(email: string, password: string): Promise<{ user: User | null, forcePasswordChange: boolean }> {
    return await loginServer(email, password);
}

/**
 * Logs out the current user.
 */
export async function logout() {
    await logoutServer();
}

/**
 * Retrieves the currently logged-in user from the server.
 */
export async function getCurrentUser(): Promise<User | null> {
    return await getCurrentUserServer();
}

/**
 * Retrieves all users from the server.
 */
export async function getAllUsers(): Promise<User[]> {
    return await getAllUsersServer();
}

/**
 * Adds a new user.
 */
export async function addUser(userData: Omit<User, 'id'> & { password: string }): Promise<User> {
    return await addUserServer(userData);
}

/**
 * Updates a user.
 */
export async function updateUser(user: User): Promise<User> {
    return await updateUserServer(user);
}

/**
 * Deletes a user.
 */
export async function deleteUser(id: number): Promise<void> {
    return await deleteUserServer(id);
}

/**
 * Saves all users (masive update).
 */
export async function saveAllUsers(users: User[]): Promise<void> {
    for (const user of users) {
        await updateUserServer(user);
    }
}

/**
 * Compares passwords.
 */
export async function comparePasswords(userId: number, password: string): Promise<boolean> {
    return await comparePasswordsServer(userId, password);
}
