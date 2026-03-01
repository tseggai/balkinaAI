import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardOverview() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!tenant) redirect('/auth/login');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

  const { count: todayCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .gte('start_time', todayStart)
    .lt('start_time', todayEnd);

  const { data: weekAppts } = await supabase
    .from('appointments')
    .select('total_price')
    .eq('tenant_id', tenant.id)
    .gte('start_time', weekStart)
    .in('status', ['confirmed', 'completed']);

  const weekRevenue = (weekAppts ?? []).reduce((sum, a) => sum + (a.total_price ?? 0), 0);

  const { data: customerRows } = await supabase
    .from('appointments')
    .select('customer_id')
    .eq('tenant_id', tenant.id);
  const uniqueCustomers = new Set((customerRows ?? []).map((r) => r.customer_id)).size;

  const { count: pendingCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('status', 'pending');

  const { data: recentAppts } = await supabase
    .from('appointments')
    .select('*, services(name), customers(display_name, email), staff(name)')
    .eq('tenant_id', tenant.id)
    .order('start_time', { ascending: false })
    .limit(10);

  const stats = [
    { label: "Today's Appointments", value: String(todayCount ?? 0) },
    { label: "Week's Revenue", value: `$${weekRevenue.toFixed(2)}` },
    { label: 'Total Customers', value: String(uniqueCustomers) },
    { label: 'Pending Actions', value: String(pendingCount ?? 0) },
  ];

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Overview of your business.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Recent Appointments</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {recentAppts && recentAppts.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentAppts.map((appt) => {
                  const customer = appt.customers as { display_name: string | null; email: string | null } | null;
                  const service = appt.services as { name: string } | null;
                  const staffMember = appt.staff as { name: string } | null;
                  return (
                    <tr key={appt.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {customer?.display_name ?? customer?.email ?? 'Unknown'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{service?.name ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{staffMember?.name ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {new Date(appt.start_time).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={appt.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                        ${appt.total_price.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">No appointments yet.</p>
              <p className="mt-1 text-xs text-gray-400">Appointments will appear here once customers start booking.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
