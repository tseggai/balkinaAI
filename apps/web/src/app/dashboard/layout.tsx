import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/dashboard-shell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('*, subscription_plans(*)')
    .eq('user_id', user.id)
    .single();

  const tenant = tenantData as { name: string; subscription_plans: { name?: string } | null } | null;
  if (!tenant) redirect('/auth/register');

  const planName = tenant.subscription_plans?.name ?? 'Free';

  return (
    <DashboardShell tenantName={tenant.name} planName={planName}>
      {children}
    </DashboardShell>
  );
}
