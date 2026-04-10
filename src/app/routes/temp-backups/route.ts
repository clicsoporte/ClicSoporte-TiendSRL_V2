/**
 * @fileoverview Redundant route neutralized to avoid build-time PageNotFoundError.
 * All traffic should go to /api/temp-backups.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    return new NextResponse(null, { 
        status: 301, 
        headers: { 'Location': '/api/temp-backups' } 
    });
}
