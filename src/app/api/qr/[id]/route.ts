/**
 * @fileoverview API Route for autonomous QR Code generation.
 * Marked as strictly dynamic to avoid build-time static generation errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import QRCode from 'qrcode';
import type { Equipment } from '@/modules/core/types';

// Ensure the route is never statically generated during build
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(
    request: NextRequest,
    context: { params: { id: string } }
) {
    // Build-time safety: contest.params might be empty or missing during some build phases
    const id = context?.params?.id;
    
    if (!id || id === '[id]') {
        return new NextResponse('Missing or invalid ID', { status: 400 });
    }

    try {
        const db = await connectDb();
        const equipment = db.prepare('SELECT * FROM inventory_equipment WHERE id = ?').get(id) as Equipment | undefined;

        if (!equipment) {
            return new NextResponse('Equipment not found', { status: 404 });
        }

        const techSheet = [
            `EQUIPO: ${equipment.nickname}`,
            `MARCA: ${equipment.brand}`,
            `MODELO: ${equipment.model}`,
            `SERIAL: ${equipment.serialNumber || 'N/A'}`,
            `USUARIO: ${equipment.assignedUser || 'Sin asignar'}`,
            `UBICACION: ${equipment.location || 'N/A'}`,
            `ID_SISTEMA: ${equipment.id}`,
            `GENERADO: ${new Date().toLocaleDateString()}`
        ].join('\n');

        const qrSvg = await QRCode.toString(techSheet, {
            type: 'svg',
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        return new NextResponse(qrSvg, {
            status: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });

    } catch (error: unknown) {
        console.error('QR Generation Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
