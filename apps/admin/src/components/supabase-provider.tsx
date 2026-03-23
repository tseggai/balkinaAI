'use client';

import { useRef } from 'react';
import { setSupabaseConfig } from '@/lib/supabase/client';

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
