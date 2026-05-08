/**
 * @fileoverview API Route to safely serve and delete temporary export files.
 * Optimized for production build compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const fileName = searchParams.get('file');

        if (!fileName) {
            return new NextResponse('Filename is required', { status: 400 });
        }

        const sanitizedFileName = path.basename(fileName);
        const exportDirectory = path.join(process.cwd(), 'dbs', 'temp_exports');
        const filePath = path.join(exportDirectory, sanitizedFileName);
        
        if (!fs.existsSync(filePath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        const stats = fs.statSync(filePath);
        const fileBuffer = fs.readFileSync(filePath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${sanitizedFileName}"`,
                'Content-Length': String(stats.size),
                'Cache-Control': 'no-store, max-age=0',
            },
        });

    } catch (error: unknown) {
        console.error(`Failed to read export file: ${(error as Error).message}`);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
        return new NextResponse('Filename is required', { status: 400 });
    }

    const sanitizedFileName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'dbs', 'temp_exports', sanitizedFileName);

    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            return new NextResponse('File deleted successfully', { status: 200 });
        } catch (error: unknown) {
            console.error(`Failed to delete export file: ${(error as Error).message}`);
            return new NextResponse('Internal Server Error', { status: 500 });
        }
    }
    return new NextResponse('File not found', { status: 404 });
}
