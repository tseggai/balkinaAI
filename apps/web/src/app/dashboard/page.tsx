import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, owner_name, status')
    .eq('user_id', user.id)
    .single();

  if (!tenant) {
    redirect('/auth/register');
  }

  if (tenant.status === 'pending_subscription') {
    redirect('/onboarding/select-plan');
  }

  return (
    <div>
      <header className="dashboard-header">
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          {tenant.name}
        </h1>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="btn btn-outline">
            Sign out
          </button>
        </form>
      </header>
      <main className="dashboard-content">
        <h2>Welcome, {tenant.owner_name}!</h2>
        <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
          Your dashboard is being set up. Start by adding your services and
          staff.
        </p>
      </main>
    </div>
  );
}
