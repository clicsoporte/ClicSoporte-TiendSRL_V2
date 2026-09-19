/**
 * @fileoverview API Route to safely serve temporary backup files for download.
 * Optimized for production build compatibility and secured with JWT session authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { SESSION_COOKIE } from '@/modules/core/lib/auth-constants';
import { verifySessionToken } from '@/modules/core/lib/jwt-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        // Validación de sesión y rol de administrador
        const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
        if (!sessionToken) {
            return new NextResponse('Unauthorized: Se requiere iniciar sesión.', { status: 401 });
        }

        const payload = verifySessionToken(sessionToken);
        if (!payload || payload.role !== 'admin') {
            return new NextResponse('Forbidden: Se requieren permisos de Administrador.', { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const fileName = searchParams.get('file');

        if (!fileName) {
            return new NextResponse('Filename is required', { status: 400 });
        }

        const sanitizedFileName = path.basename(fileName);
        const backupDir = path.join(process.cwd(), 'dbs', 'update_backups');
        const filePath = path.join(backupDir, sanitizedFileName);
        
        if (!fs.existsSync(filePath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        const stats = fs.statSync(filePath);
        const fileBuffer = fs.readFileSync(filePath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/x-sqlite3',
                'Content-Disposition': `attachment; filename="${sanitizedFileName}"`,
                'Content-Length': String(stats.size),
                'Cache-Control': 'no-store, max-age=0',
            },
        });

    } catch (error: unknown) {
        console.error(`Failed to read backup file: ${(error as Error).message}`);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

