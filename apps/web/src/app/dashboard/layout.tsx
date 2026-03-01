import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';

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

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*, subscription_plans(*)')
    .eq('user_id', user.id)
    .single();

  if (!tenant) redirect('/auth/login');

  const planName =
    (tenant.subscription_plans as { name?: string } | null)?.name ?? 'Free';

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        tenantName={tenant.name}
        planName={planName}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
