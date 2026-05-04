import { NextResponse } from 'next/server';

/**
 * Ensure upstream client IPs reach the Express API when using Next rewrites.
 * Vercel sets `x-vercel-forwarded-for`; some stacks only set `cf-connecting-ip`.
 */
export function middleware(request) {
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  const h = new Headers(request.headers);
  if (!h.get('x-forwarded-for')) {
    const v = h.get('x-vercel-forwarded-for') || h.get('cf-connecting-ip');
    if (v) {
      h.set('x-forwarded-for', v);
    }
  }
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: '/api/:path*' };
