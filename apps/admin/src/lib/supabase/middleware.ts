import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options as never);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public paths
  const isPublicPath =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname === '/';

  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value);
    });
    return res;
  }

  if (!user && !isPublicPath) {
    return redirectTo('/auth/login');
  }

  // For admin panel: check that user has platform_admin role
  if (user && !isPublicPath) {
    const role = (user.app_metadata?.role as string) ?? '';
    if (role !== 'platform_admin') {
      return redirectTo('/auth/login?error=unauthorized');
    }
  }

  // Redirect authenticated admins away from auth pages
  if (user && pathname.startsWith('/auth/')) {
    const role = (user.app_metadata?.role as string) ?? '';
    if (role === 'platform_admin') {
      return redirectTo('/dashboard');
    }
  }

  return supabaseResponse;
}
