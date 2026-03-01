'use client';

import { createBrowserClient } from '@supabase/ssr';

// These are replaced at build time by Next.js. If they're empty,
// the Supabase URL/key were not set in the build environment.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
