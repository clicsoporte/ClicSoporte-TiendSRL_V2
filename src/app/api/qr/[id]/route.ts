/**
 * @fileoverview API Route for autonomous QR Code generation.
 * Generates an SVG string containing a text-based technical sheet.
 * Marked as force-dynamic and revalidate=0 to ensure it's not statically generated during build.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import QRCode from 'qrcode';
import type { Equipment } from '@/modules/core/types';

// Ensure the route is never statically generated during build
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // Destructure params for cleaner access during analysis
    const { id } = params;
    
    if (!id) {
        return new NextResponse('Missing ID', { status: 400 });
    }

    try {
        // Attempt to connect to DB. During build, this handles its own state.
        const db = await connectDb();
        
        // Fetch equipment details safely
        const equipment = db.prepare('SELECT * FROM inventory_equipment WHERE id = ?').get(id) as Equipment | undefined;

        if (!equipment) {
            return new NextResponse('Equipment not found', { status: 404 });
        }

        // Autonomous Technical Sheet for the QR content (offline-friendly metadata)
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

        // Generate SVG string using high-quality settings
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
        // Neutral response if something fails during data collection
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
