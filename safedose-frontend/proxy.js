// proxy.js
// Runs on the Edge runtime before every matched request.

import { NextResponse } from 'next/server';
import { verifyTokenEdge } from './lib/jwt-edge';

const ROLE_HOME = {
  admin:     '/admin/requests',
  patient:   '/patient/dashboard',
  caregiver: '/caregiver/dashboard',
};

const PROTECTED = ['/admin', '/patient', '/caregiver'];

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  const token   = req.cookies.get('safedose_token')?.value;
  const decoded = token ? await verifyTokenEdge(token) : null;

  const isAuthPage  = pathname === '/login' || pathname === '/register' || pathname === '/';
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));

  // Logged in → redirect away from landing/login/register to their dashboard
  if (isAuthPage && decoded) {
    return NextResponse.redirect(new URL(ROLE_HOME[decoded.role] ?? '/', req.url));
  }

  // Not logged in → redirect to login
  if (isProtected && !decoded) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Wrong role → redirect to their own dashboard
  if (isProtected && decoded) {
    if (!pathname.startsWith(`/${decoded.role}`)) {
      return NextResponse.redirect(new URL(ROLE_HOME[decoded.role], req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/admin/:path*',
    '/patient/:path*',
    '/caregiver/:path*',
  ],
};
