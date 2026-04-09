/**
 * @fileoverview API Route to safely serve temporary backup files for download.
 * Consolidated as the primary download endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const UPDATE_BACKUP_DIR = 'update_backups';
const dbDirectory = path.join(process.cwd(), 'dbs');

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
        return new NextResponse('Filename is required', { status: 400 });
    }

    const sanitizedFileName = path.basename(fileName);
    if (sanitizedFileName !== fileName) {
        return new NextResponse('Invalid filename', { status: 400 });
    }

    const backupDir = path.join(dbDirectory, UPDATE_BACKUP_DIR);
    const filePath = path.join(backupDir, sanitizedFileName);
    
    if (!fs.existsSync(filePath)) {
        return new NextResponse('File not found', { status: 404 });
    }

    try {
        const stats = fs.statSync(filePath);
        const dataStream = fs.createReadStream(filePath);
        
        const readableStream = new ReadableStream({
            start(controller) {
                dataStream.on('data', (chunk) => controller.enqueue(chunk));
                dataStream.on('end', () => controller.close());
                dataStream.on('error', (err) => controller.error(err));
            },
        });

        const headers = new Headers();
        headers.set('Content-Type', 'application/x-sqlite3');
        headers.set('Content-Disposition', `attachment; filename="${sanitizedFileName}"`);
        headers.set('Content-Length', String(stats.size));

        return new NextResponse(readableStream as ReadableStream<Uint8Array>, { status: 200, headers });

    } catch (error: unknown) {
        console.error(`Failed to read backup file: ${(error as Error).message}`);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
