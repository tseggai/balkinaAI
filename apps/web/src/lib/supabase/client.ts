'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useMemo } from 'react';

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;
let cachedUrl = '';
let cachedKey = '';

/**
 * Create a Supabase browser client.
 *
 * The URL and anon key are injected at runtime by <SupabaseProvider> in the
 * root layout (server component → client context), so this module never
 * references process.env on the client side.
 */
export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error(
      'Supabase client not initialised. Ensure <SupabaseProvider> wraps the app in layout.tsx.'
    );
  }

  // Re-use the same instance when url+key haven't changed
  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  cachedUrl = url;
  cachedKey = key;
  cachedClient = createBrowserClient(url, key);
  return cachedClient;
}

// ── Runtime config store (populated by SupabaseProvider) ──────────────────────

let _supabaseUrl = '';
let _supabaseAnonKey = '';

export function setSupabaseConfig(url: string, anonKey: string) {
  _supabaseUrl = url;
  _supabaseAnonKey = anonKey;
}

export function getSupabaseUrl() {
  return _supabaseUrl;
}

export function getSupabaseAnonKey() {
  return _supabaseAnonKey;
}

/**
 * React hook that returns a stable Supabase client. Prefer this in components
 * that are rendered inside <SupabaseProvider>.
 */
export function useSupabase() {
  return useMemo(() => createClient(), []);
}
