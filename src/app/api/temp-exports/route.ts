/**
 * @fileoverview API Route to securely serve and delete temporary export files.
 * This handler manages downloading and cleaning up files created by server actions,
 * like Excel exports. It includes security checks to prevent path traversal.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const EXPORT_DIR = 'temp_exports';
const exportDirectory = path.join(process.cwd(), 'dbs', EXPORT_DIR);

// Ensure the temporary directory exists on server start
if (!fs.existsSync(exportDirectory)) {
    fs.mkdirSync(exportDirectory, { recursive: true });
}

/**
 * Handles GET requests to download a temporary export file.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A response object containing the file stream or an error.
 */
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


/**
 * Handles DELETE requests to remove a temporary export file.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A success or error response.
 */
export async function DELETE(request: NextRequest) {
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
        fs.unlinkSync(filePath);
        return new NextResponse('File deleted successfully', { status: 200 });
    } catch (error: unknown) {
        console.error(`Failed to delete export file: ${(error as Error).message}`);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
