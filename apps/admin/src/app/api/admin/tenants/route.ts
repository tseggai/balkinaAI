import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)));
  const status = searchParams.get('status');
  const search = searchParams.get('search');
  const planFilter = searchParams.get('plan');
  const paymentsFilter = searchParams.get('payments');
  const sortBy = searchParams.get('sort') ?? 'created_at';
  const sortDir = searchParams.get('dir') === 'asc' ? true : false;

  const from = (page - 1) * perPage;
  let query = auth.supabase
    .from('tenants')
    .select('id, name, owner_name, email, phone, status, payments_enabled, avg_rating, review_count, logo_url, created_at, subscription_plan_id, subscription_plans(id, name)', { count: 'exact' })
    .range(from, from + perPage - 1);

  // Filters
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,owner_name.ilike.%${search}%`);
  if (planFilter) query = query.eq('subscription_plan_id', planFilter);
  if (paymentsFilter === 'true') query = query.eq('payments_enabled', true);
  if (paymentsFilter === 'false') query = query.eq('payments_enabled', false);

  // Sort
  const validSorts = ['created_at', 'name', 'avg_rating', 'review_count', 'status'];
  const sortColumn = validSorts.includes(sortBy) ? sortBy : 'created_at';
  query = query.order(sortColumn, { ascending: sortDir, nullsFirst: false });

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tenants = data ?? [];
  const tenantIds = tenants.map((t: { id: string }) => t.id);

  // Fetch counts for these tenants in parallel
  const locationCounts: Record<string, number> = {};
  const staffCounts: Record<string, number> = {};
  const serviceCounts: Record<string, number> = {};

  if (tenantIds.length > 0) {
    const [locResult, staffResult, serviceResult] = await Promise.all([
      auth.supabase
        .from('tenant_locations')
        .select('tenant_id')
        .in('tenant_id', tenantIds),
      auth.supabase
        .from('staff')
        .select('tenant_id')
        .in('tenant_id', tenantIds),
      auth.supabase
        .from('services')
        .select('tenant_id')
        .in('tenant_id', tenantIds),
    ]);

    // Count per tenant
    for (const row of (locResult.data ?? []) as { tenant_id: string }[]) {
      locationCounts[row.tenant_id] = (locationCounts[row.tenant_id] ?? 0) + 1;
    }
    for (const row of (staffResult.data ?? []) as { tenant_id: string }[]) {
      staffCounts[row.tenant_id] = (staffCounts[row.tenant_id] ?? 0) + 1;
    }
    for (const row of (serviceResult.data ?? []) as { tenant_id: string }[]) {
      serviceCounts[row.tenant_id] = (serviceCounts[row.tenant_id] ?? 0) + 1;
    }
  }

  // Fetch available plans for filter dropdown
  const { data: plans } = await auth.supabase
    .from('subscription_plans')
    .select('id, name')
    .order('name');

  const enriched = tenants.map((t: { id: string }) => ({
    ...t,
    location_count: locationCounts[t.id] ?? 0,
    staff_count: staffCounts[t.id] ?? 0,
    service_count: serviceCounts[t.id] ?? 0,
  }));

  return NextResponse.json({
    data: enriched,
    total: count ?? 0,
    page,
    per_page: perPage,
    plans: plans ?? [],
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { id, status, payments_enabled } = body as { id: string; status?: string; payments_enabled?: boolean };

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (payments_enabled !== undefined) updates.payments_enabled = payments_enabled;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('tenants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
