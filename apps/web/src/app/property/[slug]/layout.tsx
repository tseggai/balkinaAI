import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: admin } = await supabase
    .from('property_admins')
    .select('property_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin) redirect('/auth/login');

  const { data: property } = await supabase
    .from('properties')
    .select('name, slug, logo_url, primary_color')
    .eq('id', (admin as { property_id: string }).property_id)
    .single();

  if (!property || (property as { slug: string }).slug !== slug) redirect('/auth/login');

  const p = property as { name: string; slug: string; logo_url: string | null; primary_color: string };

  return (
    <div data-property-name={p.name} data-property-logo={p.logo_url ?? ''} data-property-color={p.primary_color}>
      {children}
    </div>
  );
}
