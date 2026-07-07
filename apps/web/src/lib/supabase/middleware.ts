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
    pathname.startsWith('/widget/') ||
    pathname.startsWith('/pay/') ||
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

  // For authenticated users, check tenant status
  let tenant: { status: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from('tenants')
      .select('status')
      .eq('user_id', user.id)
      .single();
    tenant = data;
  }

  if (user && !isPublicPath) {
    if (!tenant && !pathname.startsWith('/property/')) {
      // Check if user is a property admin before redirecting to register
      const { data: propAdmin, error: paErr } = await supabase
        .from('property_admins')
        .select('property_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      console.log('[middleware] property admin check:', user.id, propAdmin, paErr?.message);
      if (propAdmin) {
        const pid = (propAdmin as { property_id: string }).property_id;
        const { data: prop } = await supabase
          .from('properties')
          .select('slug')
          .eq('id', pid)
          .single();
        const slug = (prop as { slug: string } | null)?.slug;
        if (slug) {
          return redirectTo(`/property/${slug}`);
        }
      } else {
        return redirectTo('/auth/register');
      }
    }

    if (
      tenant && tenant.status === 'pending_subscription' &&
      !pathname.startsWith('/onboarding')
    ) {
      return redirectTo('/onboarding/select-plan');
    }

    if (
      tenant && tenant.status === 'suspended' &&
      !pathname.startsWith('/billing')
    ) {
      return redirectTo('/billing/reactivate');
    }
  }

  // Redirect authenticated users away from auth pages — but only if they
  // have a valid tenant. Users without a tenant need access to auth pages.
  if (user && tenant && pathname.startsWith('/auth/') && pathname !== '/auth/reset-password') {
    return redirectTo('/dashboard');
  }

  return supabaseResponse;
}
