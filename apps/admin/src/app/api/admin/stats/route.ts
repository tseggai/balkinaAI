import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const supabase = auth.supabase;

  const [tenantsRes, customersRes, appointmentsRes, reviewsRes, plansRes] = await Promise.all([
    supabase.from('tenants').select('id, status, subscription_plan_id, created_at', { count: 'exact' }),
    supabase.from('customers').select('id', { count: 'exact' }),
    supabase.from('appointments').select('id, status, total_price, created_at'),
    supabase.from('reviews').select('id', { count: 'exact' }),
    supabase.from('subscription_plans').select('id, name'),
  ]);

  const tenants = (tenantsRes.data ?? []) as { id: string; status: string; subscription_plan_id: string | null; created_at: string }[];
  const appointments = (appointmentsRes.data ?? []) as { id: string; status: string; total_price: number; created_at: string }[];

  // Tenant status breakdown
  const tenantStatusCounts: Record<string, number> = {};
  for (const t of tenants) {
    tenantStatusCounts[t.status] = (tenantStatusCounts[t.status] ?? 0) + 1;
  }

  // Revenue
  const totalRevenue = appointments
    .filter((a) => a.status === 'completed' || a.status === 'confirmed')
    .reduce((sum, a) => sum + (a.total_price ?? 0), 0);

  // Appointment status breakdown
  const appointmentStatusCounts: Record<string, number> = {};
  for (const a of appointments) {
    appointmentStatusCounts[a.status] = (appointmentStatusCounts[a.status] ?? 0) + 1;
  }

  // New tenants this month
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const newTenantsThisMonth = tenants.filter((t) => t.created_at >= thisMonthStart).length;

  // Plan distribution
  const planNames = new Map((plansRes.data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
  const planDistribution: Record<string, number> = {};
  for (const t of tenants) {
    const planName = (t.subscription_plan_id ? planNames.get(t.subscription_plan_id) : null) ?? 'No Plan';
    planDistribution[planName] = (planDistribution[planName] ?? 0) + 1;
  }

  return NextResponse.json({
    tenants: {
      total: tenantsRes.count ?? 0,
      statusBreakdown: tenantStatusCounts,
      newThisMonth: newTenantsThisMonth,
      planDistribution,
    },
    customers: {
      total: customersRes.count ?? 0,
    },
    appointments: {
      total: appointments.length,
      statusBreakdown: appointmentStatusCounts,
      totalRevenue,
    },
    reviews: {
      total: reviewsRes.count ?? 0,
    },
  });
}
