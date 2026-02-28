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

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
if (!supabaseAnonKey) throw new Error('SUPABASE_ANON_KEY is required');
if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

/**
 * Browser / anon client — respects Row Level Security.
 * Safe to use client-side. Auth state managed by Supabase SSR helpers in each app.
 */
export const createBrowserClient = () =>
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });

/**
 * Server-side admin client — BYPASSES Row Level Security.
 * Only use inside secure server-side API routes after verifying the caller.
 * NEVER use in client components, mobile app, or anywhere the bundle is public.
 */
export const createServerAdminClient = () =>
  createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
