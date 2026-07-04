import { NextRequest, NextResponse } from 'next/server';

// Edge middleware cannot read Vercel "Sensitive" env vars (often inlined as "").
const validUsername = process.env.DASHBOARD_USERNAME?.trim() || 'ahlcrm';
const validPassword = process.env.DASHBOARD_PASSWORD?.trim() || 'AHL@CRM2026!';

export function middleware(req: NextRequest) {
  const auth = req.headers.get('authorization');

  if (!auth || !auth.startsWith('Basic ')) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Dashboard"' },
    });
  }

  const decoded = atob(auth.split(' ')[1]);
  const colonIndex = decoded.indexOf(':');
  const user = decoded.slice(0, colonIndex);
  const pass = decoded.slice(colonIndex + 1);

  if (user !== validUsername || pass !== validPassword) {
    return new NextResponse('Invalid credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Dashboard"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
