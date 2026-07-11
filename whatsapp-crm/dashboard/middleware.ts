import { NextRequest, NextResponse } from 'next/server';

// Auth removed — dashboard is open to anyone with the URL
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
