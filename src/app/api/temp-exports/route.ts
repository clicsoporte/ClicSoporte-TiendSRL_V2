/**
 * @fileoverview API Route to safely serve and delete temporary export files.
 * Consolidated as the primary export endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const EXPORT_DIR = 'temp_exports';
const exportDirectory = path.join(process.cwd(), 'dbs', EXPORT_DIR);

if (!fs.existsSync(exportDirectory)) {
    fs.mkdirSync(exportDirectory, { recursive: true });
}

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

    const filePath = path.join(exportDirectory, sanitizedFileName);
    
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
                dataStream.on('error', (err: Error) => controller.error(err));
            },
        });

        const headers = new Headers();
        headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        headers.set('Content-Disposition', `attachment; filename="${sanitizedFileName}"`);
        headers.set('Content-Length', String(stats.size));

        return new NextResponse(readableStream as ReadableStream<Uint8Array>, { status: 200, headers });

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
    const filePath = path.join(exportDirectory, sanitizedFileName);

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
