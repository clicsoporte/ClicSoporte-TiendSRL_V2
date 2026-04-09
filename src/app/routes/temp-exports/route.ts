/**
 * @fileoverview Placeholder to avoid build ambiguity.
 * Redundant with /api/temp-exports.
 */
import { NextResponse } from 'next/server';

export async function GET() {
    return new NextResponse('Route moved to /api/temp-exports', { status: 301, headers: { 'Location': '/api/temp-exports' } });
}
