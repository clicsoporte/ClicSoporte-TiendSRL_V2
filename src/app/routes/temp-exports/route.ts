/**
 * @fileoverview Obsolete redirection file. 
 * Logic moved to src/app/api/temp-exports/route.ts
 */
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Redundant route. Use /api/temp-exports instead.', { status: 410 });
}
