/**
 * @fileoverview API Route for autonomous QR Code generation.
 * Generates an SVG/PNG containing a text-based technical sheet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import QRCode from 'qrcode';
import type { Equipment } from '@/modules/core/types';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const id = params.id;
    if (!id) return new NextResponse('Missing ID', { status: 400 });

    try {
        const db = await connectDb();
        const equipment = db.prepare('SELECT * FROM inventory_equipment WHERE id = ?').get(id) as Equipment | undefined;

        if (!equipment) {
            return new NextResponse('Equipment not found', { status: 404 });
        }

        // autonomous Technical Sheet for the QR content (works offline after scanning)
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

        // Generate high-quality SVG string
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

    } catch (error) {
        console.error('QR Generation Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
