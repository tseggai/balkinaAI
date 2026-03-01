import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({
            request,
          });
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

  // Public paths that don't require auth
  const isPublicPath =
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname === '/';

  // Redirect helper that copies Set-Cookie headers from supabaseResponse
  // (token refreshes) onto the redirect response. Without this, redirects
  // discard refreshed session cookies and cause an infinite loop.
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

  if (user && !isPublicPath) {
    // Check tenant status and redirect accordingly
    const { data: tenant } = await supabase
      .from('tenants')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (!tenant) {
      // User exists but has no tenant record (incomplete registration).
      // Send them to register instead of letting pages redirect to login.
      return redirectTo('/auth/register');
    }

    if (
      tenant.status === 'pending_subscription' &&
      !pathname.startsWith('/onboarding')
    ) {
      return redirectTo('/onboarding/select-plan');
    }

    if (
      tenant.status === 'suspended' &&
      !pathname.startsWith('/billing')
    ) {
      return redirectTo('/billing/reactivate');
    }
  }

  // Redirect authenticated users away from auth pages
  if (user && pathname.startsWith('/auth/')) {
    return redirectTo('/dashboard');
  }

  return supabaseResponse;
}
