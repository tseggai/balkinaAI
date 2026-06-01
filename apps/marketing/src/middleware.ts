import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const pathname = request.nextUrl.pathname;

  // Skip for main domains and API/static paths
  if (
    hostname === 'balkina.ai' ||
    hostname === 'www.balkina.ai' ||
    hostname.includes('localhost') ||
    hostname.includes('vercel.app') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/b/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Custom domain — rewrite to /p/[slug] by looking up the domain
  // For now, rewrite root to /p/custom-domain-lookup
  // The property page will handle the domain-to-slug resolution
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = `/p/_domain`;
    url.searchParams.set('domain', hostname);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
