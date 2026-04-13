/**
 * @fileoverview Redundant route handler.
 * Returning a minimal response to prevent build conflicts.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return new NextResponse('Redirected to /api/temp-exports', { status: 404 });
}
