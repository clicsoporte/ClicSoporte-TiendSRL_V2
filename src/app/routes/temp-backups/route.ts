/**
 * @fileoverview Obsolete redirection file. 
 * Logic moved to src/app/api/temp-backups/route.ts
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return new NextResponse('Route moved to /api/temp-backups', { status: 410 });
}
