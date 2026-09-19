import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/modules/core/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: 'Correo y contraseña requeridos' }, { status: 400 });
        }

        const result = await login(email, password);

        if (!result.user) {
            return NextResponse.json(
                { error: result.error || 'Correo o contraseña incorrectos' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            user: result.user,
            forcePasswordChange: result.forcePasswordChange
        });

    } catch (error: unknown) {
        console.error('API Login error:', error);
        return NextResponse.json({ error: 'Error en el servidor al procesar el inicio de sesión' }, { status: 500 });
    }
}
