import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Note: Database generic removed due to @supabase/ssr v0.3.0 type incompatibility
// with @supabase/supabase-js v2.98.0. Upgrade @supabase/ssr to restore typed queries.

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options as never);
            }
          } catch {
            // The `setAll` method is called from a Server Component where
            // cookies cannot be set. This can be safely ignored when
            // reading cookies in Server Components.
          }
        },
      },
    }
  );
}

export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Admin client does not use cookies
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
