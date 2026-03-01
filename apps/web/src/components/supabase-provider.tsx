'use client';

import { useRef } from 'react';
import { setSupabaseConfig } from '@/lib/supabase/client';

/**
 * Receives Supabase config from the server-side root layout and injects it
 * into the client-side module store. This avoids any process.env references
 * in client code — the server component reads the env vars and passes them
 * as props.
 */
export function SupabaseProvider({
  supabaseUrl,
  supabaseAnonKey,
  children,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  children: React.ReactNode;
}) {
  const initialised = useRef(false);
  if (!initialised.current) {
    setSupabaseConfig(supabaseUrl, supabaseAnonKey);
    initialised.current = true;
  }

  return <>{children}</>;
}
