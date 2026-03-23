'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useMemo } from 'react';

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;
let cachedUrl = '';
let cachedKey = '';

export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error(
      'Supabase client not initialised. Ensure <SupabaseProvider> wraps the app in layout.tsx.'
    );
  }

  if (cachedClient && cachedUrl === url && cachedKey === key) {
    return cachedClient;
  }

  cachedUrl = url;
  cachedKey = key;
  cachedClient = createBrowserClient(url, key);
  return cachedClient;
}

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

export function useSupabase() {
  return useMemo(() => createClient(), []);
}
