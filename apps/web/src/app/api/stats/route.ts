import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function GET(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? 'this_month';

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  let from: Date;
  let to: Date;

  switch (period) {
    case 'today':
      from = new Date(y, m, d);
      to = new Date(y, m, d + 1);
      break;
    case 'this_week': {
      const dayOfWeek = now.getDay();
      from = new Date(y, m, d - dayOfWeek);
      to = new Date(y, m, d - dayOfWeek + 7);
      break;
    }
    case 'this_year':
      from = new Date(y, 0, 1);
      to = new Date(y + 1, 0, 1);
      break;
    case 'last_month':
      from = new Date(y, m - 1, 1);
      to = new Date(y, m, 1);
      break;
    case 'this_month':
    default:
      from = new Date(y, m, 1);
      to = new Date(y, m + 1, 1);
      break;
  }

  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  const supabase = createAdminClient();

  // Run all queries in parallel
  const [appointmentsRes, allAppointmentsRes, staffRes, servicesRes, reviewsRes] = await Promise.all([
    // Period appointments
    supabase
      .from('appointments')
      .select('id, status, total_price, start_time, service_id, staff_id, customer_id')
      .eq('tenant_id', tenantId)
      .gte('start_time', fromISO)
      .lt('start_time', toISO),
    // All appointments (for all-time stats)
    supabase
      .from('appointments')
      .select('id, status, total_price, start_time, customer_id, created_at')
      .eq('tenant_id', tenantId),
    // Staff
    supabase
      .from('staff')
      .select('id, name')
      .eq('tenant_id', tenantId),
    // Services
    supabase
      .from('services')
      .select('id, name, price')
      .eq('tenant_id', tenantId),
    // Tenant reviews stats
    supabase
      .from('tenants')
      .select('avg_rating, review_count')
      .eq('id', tenantId)
      .single(),
  ]);

  const periodAppts = (appointmentsRes.data ?? []) as { id: string; status: string; total_price: number; start_time: string; service_id: string; staff_id: string; customer_id: string }[];
  const allAppts = (allAppointmentsRes.data ?? []) as { id: string; status: string; total_price: number; start_time: string; customer_id: string; created_at: string }[];
  const staffList = (staffRes.data ?? []) as { id: string; name: string }[];
  const servicesList = (servicesRes.data ?? []) as { id: string; name: string; price: number }[];
  const tenantStats = reviewsRes.data as { avg_rating: number | null; review_count: number } | null;

  // ── Revenue ────────────────────────────────────────────────────────────
  const periodRevenue = periodAppts
    .filter((a) => a.status === 'completed' || a.status === 'confirmed')
    .reduce((sum, a) => sum + (a.total_price ?? 0), 0);

  const allTimeRevenue = allAppts
    .filter((a) => a.status === 'completed' || a.status === 'confirmed')
    .reduce((sum, a) => sum + (a.total_price ?? 0), 0);

  // ── Status breakdown ───────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  for (const a of periodAppts) {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  }

  // ── Top services ───────────────────────────────────────────────────────
  const serviceBookings: Record<string, { count: number; revenue: number }> = {};
  for (const a of periodAppts) {
    if (!a.service_id) continue;
    if (!serviceBookings[a.service_id]) serviceBookings[a.service_id] = { count: 0, revenue: 0 };
    const svcEntry = serviceBookings[a.service_id];
    if (svcEntry) {
      svcEntry.count++;
      if (a.status === 'completed' || a.status === 'confirmed') {
        svcEntry.revenue += a.total_price ?? 0;
      }
    }
  }

  const serviceNameMap = new Map(servicesList.map((s) => [s.id, s.name]));
  const topServices = Object.entries(serviceBookings)
    .map(([id, data]) => ({ id, name: serviceNameMap.get(id) ?? 'Unknown', ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Top staff ──────────────────────────────────────────────────────────
  const staffBookings: Record<string, { count: number; revenue: number }> = {};
  for (const a of periodAppts) {
    if (!a.staff_id) continue;
    if (!staffBookings[a.staff_id]) staffBookings[a.staff_id] = { count: 0, revenue: 0 };
    const staffEntry = staffBookings[a.staff_id];
    if (staffEntry) {
      staffEntry.count++;
      if (a.status === 'completed' || a.status === 'confirmed') {
        staffEntry.revenue += a.total_price ?? 0;
      }
    }
  }

  const staffNameMap = new Map(staffList.map((s) => [s.id, s.name]));
  const topStaff = Object.entries(staffBookings)
    .map(([id, data]) => ({ id, name: staffNameMap.get(id) ?? 'Unknown', ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Customer metrics ───────────────────────────────────────────────────
  const periodCustomerIds = new Set(periodAppts.map((a) => a.customer_id));
  const totalUniqueCustomers = new Set(allAppts.map((a) => a.customer_id)).size;

  // New customers in period (first appointment in the period)
  const customerFirstDates = new Map<string, string>();
  for (const a of allAppts) {
    const existing = customerFirstDates.get(a.customer_id);
    if (!existing || a.created_at < existing) {
      customerFirstDates.set(a.customer_id, a.created_at);
    }
  }
  let newCustomersInPeriod = 0;
  for (const cid of periodCustomerIds) {
    const firstDate = customerFirstDates.get(cid);
    if (firstDate && firstDate >= fromISO && firstDate < toISO) {
      newCustomersInPeriod++;
    }
  }

  // Returning customers (had appointments before this period)
  let returningCustomers = 0;
  for (const cid of periodCustomerIds) {
    const firstDate = customerFirstDates.get(cid);
    if (firstDate && firstDate < fromISO) {
      returningCustomers++;
    }
  }

  // ── Daily revenue for bar chart ────────────────────────────────────────
  const dailyRevenue: { date: string; revenue: number; count: number }[] = [];
  const dayMs = 86400000;
  const startMs = from.getTime();
  const endMs = to.getTime();
  const numDays = Math.min(Math.ceil((endMs - startMs) / dayMs), 366);

  for (let i = 0; i < numDays; i++) {
    const dayStart = new Date(startMs + i * dayMs);
    const dayKey = dayStart.toISOString().slice(0, 10);
    dailyRevenue.push({ date: dayKey, revenue: 0, count: 0 });
  }

  for (const a of periodAppts) {
    const dayKey = a.start_time.slice(0, 10);
    const entry = dailyRevenue.find((d) => d.date === dayKey);
    if (entry) {
      entry.count++;
      if (a.status === 'completed' || a.status === 'confirmed') {
        entry.revenue += a.total_price ?? 0;
      }
    }
  }

  return NextResponse.json({
    period,
    from: fromISO,
    to: toISO,
    revenue: {
      period: periodRevenue,
      allTime: allTimeRevenue,
    },
    appointments: {
      total: periodAppts.length,
      statusBreakdown: statusCounts,
    },
    topServices,
    topStaff,
    customers: {
      periodActive: periodCustomerIds.size,
      totalUnique: totalUniqueCustomers,
      newInPeriod: newCustomersInPeriod,
      returning: returningCustomers,
    },
    reviews: {
      avgRating: tenantStats?.avg_rating ?? null,
      totalCount: tenantStats?.review_count ?? 0,
    },
    dailyRevenue,
  });
}
