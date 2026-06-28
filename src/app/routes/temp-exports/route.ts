/**
 * @fileoverview Obsolete redirection file. 
 * Logic moved to src/app/api/temp-exports/route.ts
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return new NextResponse('Route moved to /api/temp-exports', { status: 410 });
}
