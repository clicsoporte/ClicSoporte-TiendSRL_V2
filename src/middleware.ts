/**
 * @fileoverview Edge Middleware for global session protection.
 * This runs before any request to the dashboard, ensuring a valid session cookie exists.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from './modules/core/lib/auth-constants';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const session = request.cookies.get(SESSION_COOKIE);

    // If no session exists, redirect to login
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      
      // If we are already on the login page or internal static files, don't redirect
      if (pathname === '/') return NextResponse.next();
      
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Ensure the middleware matches all dashboard paths
export const config = {
  matcher: ['/dashboard/:path*'],
};
