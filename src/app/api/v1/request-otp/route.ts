/**
 * @fileoverview API Endpoint for requesting an OTP validation code.
 * Used by software children to start the register-free handshake.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestOtp } from '@/modules/core/lib/otp-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    let body: { email?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Cuerpo de solicitud JSON no válido.' }, { status: 400 });
    }

    try {
        const { email } = body;

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'El correo electrónico es requerido.' }, { status: 400 });
        }

        const success = await requestOtp(email.trim().toLowerCase());

        if (success) {
            return NextResponse.json({ 
                success: true, 
                message: 'Código enviado. Revisa tu bandeja de entrada.' 
            });
        } else {
            return NextResponse.json({ 
                error: 'No se pudo enviar el código. Verifica tu conexión o intenta más tarde.' 
            }, { status: 500 });
        }

    } catch (error: unknown) {
        console.error('Request OTP API Error:', error);
        return NextResponse.json({ error: 'Error interno del servidor al procesar la solicitud.' }, { status: 500 });
    }
}
