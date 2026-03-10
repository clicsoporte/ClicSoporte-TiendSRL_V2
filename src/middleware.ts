/**
 * @fileoverview Edge Middleware for global session protection.
 * This runs before any request to the dashboard, ensuring a signed session cookie exists.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'clic_tools_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const session = request.cookies.get(SESSION_COOKIE);

    // If no session exists, redirect to login
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      // Prevent redirect loops if already on login
      if (pathname === '/') return NextResponse.next();
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/dashboard/:path*'],
};
