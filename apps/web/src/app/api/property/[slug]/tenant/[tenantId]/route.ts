import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';

/**
 * GET /api/property/[slug]/tenant/[tenantId]
 * Tenant detail + insight stats for the property owner.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; tenantId: string }> }) {
  const { slug, tenantId } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The tenant must belong to this property.
  const { data: link } = await ctx.admin
    .from('property_tenants')
    .select('id')
    .eq('property_id', ctx.propertyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: 'Business not in this property' }, { status: 404 });

  const { data: tenant } = await ctx.admin
    .from('tenants')
    .select('id, name, logo_url, cover_image_url, email, phone, description, status, created_at')
    .eq('id', tenantId)
    .maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

  const now = new Date().toISOString();

  const [{ data: appts }, { data: location }, { data: reviews }, { count: serviceCount }, { count: staffCount }] = await Promise.all([
    ctx.admin
      .from('appointments')
      .select('id, start_time, status, total_price, services(name), customers(display_name)')
      .eq('tenant_id', tenantId)
      .order('start_time', { ascending: false })
      .limit(500),
    ctx.admin.from('tenant_locations').select('name, address').eq('tenant_id', tenantId).limit(1).maybeSingle(),
    ctx.admin.from('reviews').select('rating').eq('tenant_id', tenantId),
    ctx.admin.from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ctx.admin.from('staff').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ]);

  const list = (appts ?? []) as unknown as { id: string; start_time: string; status: string; total_price: number | null; services: { name: string } | null; customers: { display_name: string | null } | null }[];
  const reviewList = (reviews ?? []) as { rating: number }[];

  const PAID = ['completed', 'confirmed', 'approved'];
  const revenue = list.filter((a) => PAID.includes(a.status)).reduce((s, a) => s + Number(a.total_price ?? 0), 0);
  const upcoming = list.filter((a) => a.start_time >= now && ['pending', 'approved', 'confirmed'].includes(a.status)).length;
  const completed = list.filter((a) => a.status === 'completed').length;
  const cancelled = list.filter((a) => a.status === 'cancelled' || a.status === 'no_show').length;
  const avgRating = reviewList.length ? reviewList.reduce((s, r) => s + r.rating, 0) / reviewList.length : null;

  const recent = list.slice(0, 6).map((a) => ({
    id: a.id,
    service: a.services?.name ?? 'Service',
    customer: a.customers?.display_name ?? 'Customer',
    date: a.start_time,
    status: a.status,
    total: Number(a.total_price ?? 0),
  }));

  return NextResponse.json({
    tenant: {
      ...tenant,
      location_name: (location as { name?: string } | null)?.name ?? null,
      address: (location as { address?: string } | null)?.address ?? null,
    },
    stats: {
      total_appointments: list.length,
      upcoming,
      completed,
      cancelled,
      revenue,
      avg_rating: avgRating,
      review_count: reviewList.length,
      service_count: serviceCount ?? 0,
      staff_count: staffCount ?? 0,
    },
    recent,
  });
}
