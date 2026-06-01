import { createClient } from '@supabase/supabase-js';
import { notFound, redirect } from 'next/navigation';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async function DomainLookup({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const { domain } = await searchParams;
  if (!domain) notFound();

  const supabase = getSupabase();
  const { data: property } = await supabase
    .from('properties')
    .select('slug')
    .eq('custom_domain', domain)
    .eq('is_active', true)
    .single();

  if (!property) notFound();

  redirect(`/p/${(property as { slug: string }).slug}`);
}
