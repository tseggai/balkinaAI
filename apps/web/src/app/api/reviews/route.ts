/**
 * GET /api/reviews?tenant_id=...&page=1&per_page=20&staff_id=...&min_rating=...
 * Returns reviews for a tenant, paginated and optionally filtered.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenant_id');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
  }

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)));
  const staffId = searchParams.get('staff_id');
  const minRating = searchParams.get('min_rating');

  const supabase = createAdminClient();
  const from = (page - 1) * perPage;

  let query = supabase
    .from('reviews')
    .select(
      'id, rating, comment, created_at, appointment_id, customers(display_name), staff(name), services:appointments!inner(services(name))',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (staffId) query = query.eq('staff_id', staffId);
  if (minRating) query = query.gte('rating', parseInt(minRating, 10));

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch tenant-level aggregates
  const { data: tenant } = await supabase
    .from('tenants')
    .select('avg_rating, review_count')
    .eq('id', tenantId)
    .single();

  const tenantStats = tenant as { avg_rating: number | null; review_count: number } | null;

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    avg_rating: tenantStats?.avg_rating ?? null,
    review_count: tenantStats?.review_count ?? 0,
  });
}
