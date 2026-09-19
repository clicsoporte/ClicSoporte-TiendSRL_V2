/**
 * @fileoverview Edge Middleware for global session protection.
 * This runs before any request to the dashboard, ensuring a valid, unexpired session JWT exists.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, DEFAULT_SESSION_SECRET } from './modules/core/lib/auth-constants';
import { verifySessionJwtWebCrypto } from './modules/core/lib/jwt-edge';

export async function middleware(request: NextRequest) {
  // Block insecure HTTP debugging methods (TRACE / TRACK)
  if (request.method === 'TRACE' || request.method === 'TRACK') {
    return new NextResponse('Method Not Allowed', { status: 405 });
  }

  const { pathname } = request.nextUrl;

  // Only protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    if (request.headers.get('x-forwarded-proto') === 'https') {
      redirectUrl.protocol = 'https:';
    }

    if (!sessionCookie) {
      if (pathname === '/') return NextResponse.next();
      return NextResponse.redirect(redirectUrl);
    }

    const secretKey =
      process.env.SESSION_SECRET?.trim() ||
      process.env.JWT_SECRET?.trim() ||
      process.env.NEXTAUTH_SECRET?.trim() ||
      DEFAULT_SESSION_SECRET;

    const validPayload = await verifySessionJwtWebCrypto(sessionCookie, secretKey);

    if (!validPayload) {
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
  }

  return NextResponse.next();
}

// Ensure the middleware matches all paths except static files
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};


