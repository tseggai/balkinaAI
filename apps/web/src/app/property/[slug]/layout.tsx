import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PropertyDashboardShell } from '@/components/property-dashboard-shell';

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
    .select('property_id, role, properties(name, slug)')
    .eq('user_id', user.id)
    .single();

  if (!admin) redirect('/auth/login');

  const prop = (admin as unknown as { properties: { name: string; slug: string } | null })?.properties;
  if (!prop || prop.slug !== slug) redirect('/auth/login');

  return (
    <PropertyDashboardShell propertyName={prop.name}>
      {children}
    </PropertyDashboardShell>
  );
}
