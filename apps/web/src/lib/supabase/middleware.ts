import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath) {
    // Check tenant status and redirect accordingly
    const { data: tenant } = await supabase
      .from('tenants')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (tenant) {
      if (
        tenant.status === 'pending_subscription' &&
        !pathname.startsWith('/onboarding')
      ) {
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding/select-plan';
        return NextResponse.redirect(url);
      }

      if (
        tenant.status === 'suspended' &&
        !pathname.startsWith('/billing')
      ) {
        const url = request.nextUrl.clone();
        url.pathname = '/billing/reactivate';
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect authenticated users away from auth pages
  if (user && pathname.startsWith('/auth/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
