/**
 * @fileoverview Server-side authentication using HttpOnly cookies and React cache.
 */
"use server";

import { cache } from 'react';
import { cookies } from 'next/headers';
import { connectDb } from './db';
import type { User } from '../types';
import bcrypt from 'bcryptjs';
import { logInfo, logWarn } from './logger';

const SESSION_COOKIE = 'clic_tools_session';
const SALT_ROUNDS = 10;

/**
 * Retrieves the currently authenticated user based on the session cookie.
 * Cached per request to ensure efficiency.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
    const cookieStore = cookies();
    const userId = cookieStore.get(SESSION_COOKIE)?.value;

    if (!userId) return null;

    try {
        const db = await connectDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId)) as User | undefined;

        if (!user) return null;

        const { password: _, ...safeUser } = user;
        return JSON.parse(JSON.stringify(safeUser));
    } catch (error) {
        console.error("Error fetching current user:", error);
        return null;
    }
});

/**
 * Attempts to log in a user.
 * @returns The user object and whether a password change is required.
 */
export async function login(email: string, passwordProvided: string): Promise<{ user: User | null, forcePasswordChange: boolean }> {
    const db = await connectDb();
    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;

        if (user && user.password) {
            const isMatch = await bcrypt.compare(passwordProvided, user.password);
            if (isMatch) {
                cookies().set(SESSION_COOKIE, String(user.id), {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 8, // 8 hours
                    path: '/',
                });

                const { password: _, ...safeUser } = user;
                await logInfo(`User '${user.name}' logged in successfully.`);
                return { 
                    user: JSON.parse(JSON.stringify(safeUser)), 
                    forcePasswordChange: !!user.forcePasswordChange 
                };
            }
        }
        await logWarn(`Failed login attempt for email: ${email}`);
        return { user: null, forcePasswordChange: false };
    } catch (error) {
        console.error("Login error:", error);
        return { user: null, forcePasswordChange: false };
    }
}

export async function logout(): Promise<void> {
    const user = await getCurrentUser();
    if (user) await logInfo(`User '${user.name}' logged out.`);
    cookies().delete(SESSION_COOKIE);
}

export async function getAllUsers(): Promise<User[]> {
    const db = await connectDb();
    const rows = db.prepare('SELECT id, name, email, phone, whatsapp, role, avatar, forcePasswordChange FROM users ORDER BY name').all() as User[];
    return JSON.parse(JSON.stringify(rows));
}

export async function addUser(userData: Omit<User, 'id'> & { password: string }): Promise<User> {
    const db = await connectDb();
    const hashedPassword = bcrypt.hashSync(userData.password, SALT_ROUNDS);
    
    const info = db.prepare(`
        INSERT INTO users (name, email, password, phone, whatsapp, role, forcePasswordChange)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userData.name, userData.email, hashedPassword, userData.phone, userData.whatsapp, userData.role, userData.forcePasswordChange ? 1 : 0);

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as User;
    const { password: _, ...safeUser } = newUser;
    return JSON.parse(JSON.stringify(safeUser));
}

export async function updateUser(user: User): Promise<User> {
    const db = await connectDb();
    let query = 'UPDATE users SET name = ?, email = ?, phone = ?, whatsapp = ?, role = ?, forcePasswordChange = ?';
    const params: (string | number | null)[] = [user.name, user.email, user.phone || null, user.whatsapp || null, user.role, user.forcePasswordChange ? 1 : 0];

    if (user.password) {
        query += ', password = ?';
        params.push(bcrypt.hashSync(user.password, SALT_ROUNDS));
    }

    query += ' WHERE id = ?';
    params.push(user.id);

    db.prepare(query).run(...params);
    return user;
}

export async function deleteUser(id: number): Promise<void> {
    const db = await connectDb();
    if (id === 1) throw new Error("No se puede eliminar al admin principal.");
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export async function comparePasswords(userId: number, password: string): Promise<boolean> {
    const db = await connectDb();
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as { password?: string };
    if (!user?.password) return false;
    return await bcrypt.compare(password, user.password);
}
