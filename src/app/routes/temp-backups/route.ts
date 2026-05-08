/**
 * @fileoverview Obsolete redirection file. 
 * Logic moved to src/app/api/temp-backups/route.ts
 */
export const dynamic = 'force-dynamic';
export async function GET() {
    return new Response('Redundant route. Use /api/temp-backups instead.', { status: 410 });
}
