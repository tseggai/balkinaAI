/**
 * Supabase client factory.
 *
 * - createBrowserClient: uses ANON key, respects RLS. Use in mobile app and
 *   Next.js client components.
 * - createServerClient: uses SERVICE ROLE key, bypasses RLS. Only use in
 *   secure server-side API routes. NEVER expose to the browser.
 *
 * Raw SQL in application code is PROHIBITED. Always use the Supabase client.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database.js';

/**
 * Browser / anon client — respects Row Level Security.
 * Safe to use client-side. Auth state managed by Supabase SSR helpers in each app.
 */
export const createBrowserClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
};

/**
 * Server-side admin client — BYPASSES Row Level Security.
 * Only use inside secure server-side API routes after verifying the caller.
 * NEVER use in client components, mobile app, or anywhere the bundle is public.
 */
export const createServerAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
