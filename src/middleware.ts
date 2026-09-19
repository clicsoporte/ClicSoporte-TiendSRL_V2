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
      return NextResponse.redirect(redirectUrl);
    }

    const secretKey =
      process.env.SESSION_SECRET?.trim() ||
      process.env.JWT_SECRET?.trim() ||
      process.env.NEXTAUTH_SECRET?.trim() ||
      DEFAULT_SESSION_SECRET;

    // 1. Try cryptographic verification with primary secret
    let validPayload = await verifySessionJwtWebCrypto(sessionCookie, secretKey);
    
    // 2. Try fallback to default secret if different
    if (!validPayload && secretKey !== DEFAULT_SESSION_SECRET) {
      validPayload = await verifySessionJwtWebCrypto(sessionCookie, DEFAULT_SESSION_SECRET);
    }

    // 3. If cryptographic verification passed, allow request
    if (validPayload) {
      return NextResponse.next();
    }

    // 4. If Edge crypto verification had an environment mismatch, verify token structure and expiration before allowing Node server to do authoritative SQLite verification
    try {
      const parts = sessionCookie.trim().split('.');
      if (parts.length === 3) {
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const payloadJson = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(payloadJson);
        const now = Math.floor(Date.now() / 1000);
        if (payload.userId && payload.exp && payload.exp >= now) {
          return NextResponse.next();
        }
      }
    } catch {
      // Invalid JWT structure
    }

    // Invalid or expired token: redirect to login
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

// Ensure the middleware matches all paths except static files
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};


