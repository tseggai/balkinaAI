'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getLabels, type LabelSet } from '@balkina/shared';

/**
 * Reads the current tenant's business_type and returns the matching LABELS pack
 * (Migration 049). Standard tenants get the default wording, so call sites can
 * use the labels unconditionally.
 */
export function useBusinessLabels(): { businessType: string; labels: LabelSet } {
  const [businessType, setBusinessType] = useState('standard');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('tenants')
        .select('business_type')
        .eq('user_id', user.id)
        .single();
      if (!cancelled && data) {
        setBusinessType((data as { business_type: string | null }).business_type ?? 'standard');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { businessType, labels: getLabels(businessType) };
}
