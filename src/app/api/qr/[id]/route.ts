/**
 * @fileoverview API Route for autonomous QR Code generation.
 * Optimized for production build compatibility and runtime-only execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDb } from '@/modules/core/lib/db';
import QRCode from 'qrcode';
import type { Equipment } from '@/modules/core/types';

// Force dynamic ensures this is never pre-rendered during build
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // Safety check for dynamic parameters during build-time tracing
    const id = params?.id;
    
    if (!id || id === '[id]' || id === 'undefined') {
        return new NextResponse('Invalid or Missing ID', { status: 400 });
    }

    try {
        const db = await connectDb();
        
        // Defensive check for table existence before querying
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_equipment'").get();
        if (!tableCheck) {
            return new NextResponse('System initialization in progress', { status: 503 });
        }

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
