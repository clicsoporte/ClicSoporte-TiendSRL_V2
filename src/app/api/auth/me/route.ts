import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/modules/core/lib/auth-constants';
import { verifySessionToken } from '@/modules/core/lib/jwt-service';
import { connectDb } from '@/modules/core/lib/db';
import type { User } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = cookies();
        const token = cookieStore.get(SESSION_COOKIE)?.value;

        if (!token) {
            return NextResponse.json({ user: null }, { status: 200 });
        }

        const payload = verifySessionToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ user: null }, { status: 200 });
        }

        const db = await connectDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as User | undefined;

        if (!user) {
            return NextResponse.json({ user: null }, { status: 200 });
        }

        const safeUser = { ...user };
        delete safeUser.password;

        return NextResponse.json({
            user: safeUser
        }, { status: 200 });

    } catch (error) {
        console.error('API /api/auth/me error:', error);
        return NextResponse.json({ user: null, error: 'Internal error' }, { status: 500 });
    }
}
