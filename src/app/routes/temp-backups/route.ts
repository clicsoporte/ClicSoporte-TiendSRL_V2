/**
 * @fileoverview Legacy route marker to satisfy Next.js type generator.
 * Real logic has moved to src/app/api/temp-backups/route.ts
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // Permanent redirect to the new official API path
    return NextResponse.redirect(new URL('/api/temp-backups', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'), 308);
}
