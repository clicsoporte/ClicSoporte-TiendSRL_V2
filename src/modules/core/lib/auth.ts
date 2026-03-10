/**
 * @fileoverview Server-side authentication and user management functions.
 */
"use server";

import { connectDb } from './db';
import type { User } from '../types';
import bcrypt from 'bcryptjs';
import { logInfo, logWarn } from './logger';
import { headers } from 'next/headers';

const SALT_ROUNDS = 10;

export async function login(email: string, passwordProvided: string): Promise<User | null> {
  const db = await connectDb();
  const requestHeaders = headers();
  const clientIp = requestHeaders.get('x-forwarded-for') ?? 'Unknown IP';
  const clientHost = requestHeaders.get('host') ?? 'Unknown Host';
  const logMeta = { email, ip: clientIp, host: clientHost };
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;

    if (user && user.password) {
      const isMatch = await bcrypt.compare(passwordProvided, user.password);
      if (isMatch) {
        const userWithoutPassword = { ...user };
        delete userWithoutPassword.password;
        await logInfo(`User '${user.name}' logged in successfully.`, logMeta);
        return JSON.parse(JSON.stringify(userWithoutPassword));
      }
    }
    await logWarn(`Failed login attempt for email: ${email}`, logMeta);
    return null;
  } catch (error: unknown) {
    console.error("Login error:", error);
    await logWarn(`Login failed for email: ${email}`, logMeta);
    return null;
  }
}

export async function logout(userId: number): Promise<void> {
    const db = await connectDb();
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
    if (user) await logInfo(`User '${user.name}' logged out.`, { userId });
}

export async function getAllUsers(): Promise<User[]> {
    const db = await connectDb();
    try {
        const users = db.prepare('SELECT * FROM users ORDER BY name').all() as User[];
        const safeUsers = users.map((u) => {
            const safe = { ...u };
            delete safe.password;
            return safe;
        });
        return JSON.parse(JSON.stringify(safeUsers));
    } catch (error) {
        console.error("Failed to get all users:", error);
        return [];
    }
}

export async function getUserById(id: number): Promise<User | null> {
    const db = await connectDb();
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
        if (!user) return null;
        const userWithoutPassword = { ...user };
        delete userWithoutPassword.password;
        return JSON.parse(JSON.stringify(userWithoutPassword));
    } catch (error) {
        console.error(`Failed to get user by ID ${id}:`, error);
        return null;
    }
}

export async function addUser(userData: Omit<User, 'id' | 'avatar' | 'recentActivity' | 'securityQuestion' | 'securityAnswer'> & { password: string }): Promise<User> {
  const db = await connectDb();
  const hashedPassword = bcrypt.hashSync(userData.password, SALT_ROUNDS);
  const highestIdResult = db.prepare('SELECT MAX(id) as maxId FROM users').get() as { maxId: number | null };
  const nextId = (highestIdResult.maxId || 0) + 1;

  const userToCreate: User = {
    id: nextId,
    name: userData.name,
    email: userData.email,
    password: hashedPassword,
    role: userData.role,
    avatar: "",
    recentActivity: "Usuario recién creado.",
    phone: userData.phone || "",
    whatsapp: userData.whatsapp || "",
  };
  
  db.prepare(`INSERT INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity, securityQuestion, securityAnswer) VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity, @securityQuestion, @securityAnswer)`)
    .run({ ...userToCreate, phone: userToCreate.phone || null, whatsapp: userToCreate.whatsapp || null, securityQuestion: userToCreate.securityQuestion || null, securityAnswer: userToCreate.securityAnswer || null });

  const userWithoutPassword = { ...userToCreate };
  delete userWithoutPassword.password;
  await logInfo(`Admin added user: ${userToCreate.name}`, { role: userToCreate.role });
  return JSON.parse(JSON.stringify(userWithoutPassword));
}

export async function saveAllUsers(users: User[]): Promise<void> {
   const db = await connectDb();
   const upsert = db.prepare(`INSERT INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity, securityQuestion, securityAnswer) VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity, @securityQuestion, @securityAnswer) ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, password = excluded.password, phone = excluded.phone, whatsapp = excluded.whatsapp, avatar = excluded.avatar, role = excluded.role, recentActivity = excluded.recentActivity, securityQuestion = excluded.securityQuestion, securityAnswer = excluded.securityAnswer`);

    const transaction = db.transaction((usersToSave: User[]) => {
        const existingUsers = new Map<number, string | undefined>((db.prepare('SELECT id, password FROM users').all() as User[]).map(u => [u.id, u.password]));
        for (const user of usersToSave) {
          let passwordToSave = user.password || existingUsers.get(user.id);
          if (passwordToSave && !passwordToSave.startsWith('$2a$')) {
              passwordToSave = bcrypt.hashSync(passwordToSave, SALT_ROUNDS);
          }
          upsert.run({ ...user, password: passwordToSave, phone: user.phone || null, whatsapp: user.whatsapp || null, securityQuestion: user.securityQuestion || null, securityAnswer: user.securityAnswer || null });
        }
    });

    transaction(users);
}

export async function comparePasswords(userId: number, password: string, clientInfo?: { ip: string, host: string }): Promise<boolean> {
    const db = await connectDb();
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as User | undefined;
    if (!user || !user.password) return false;
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) await logWarn('Password comparison failed during settings update.', clientInfo);
    return isMatch;
}
