import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';

/**
 * GET /api/property/[slug]/discover-tenants?q=&category=&limit=
 *
 * Lets a property owner discover businesses already on Balkina (and not yet in
 * this property) to add directly — matched by name/category and ranked by
 * proximity to the property's location.
 */

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const category = (searchParams.get('category') || '').trim();
  const limit = Math.min(Number(searchParams.get('limit')) || 30, 50);

  // Property location (for proximity ranking).
  const { data: prop } = await ctx.admin
    .from('properties')
    .select('latitude, longitude')
    .eq('id', ctx.propertyId)
    .single();
  const pLat = (prop as { latitude: number | null } | null)?.latitude ?? null;
  const pLng = (prop as { longitude: number | null } | null)?.longitude ?? null;

  // Businesses already in this property (excluded from discovery).
  const { data: linked } = await ctx.admin
    .from('property_tenants')
    .select('tenant_id')
    .eq('property_id', ctx.propertyId);
  const linkedIds = new Set(((linked ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id));

  // Optional category filter → tenant ids tagged with a matching category.
  let categoryTenantIds: Set<string> | null = null;
  if (category) {
    const { data: cats } = await ctx.admin
      .from('categories')
      .select('id')
      .ilike('name', `%${category}%`);
    const catIds = ((cats ?? []) as { id: string }[]).map((c) => c.id);
    if (catIds.length === 0) return NextResponse.json({ data: [] });
    const { data: links } = await ctx.admin
      .from('tenant_category_links')
      .select('tenant_id')
      .in('category_id', catIds);
    categoryTenantIds = new Set(((links ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id));
  }

  // Candidate tenants: active, name match.
  let query = ctx.admin
    .from('tenants')
    .select('id, name, logo_url, cover_image_url, status')
    .eq('status', 'active')
    .limit(120);
  if (q) query = query.ilike('name', `%${q}%`);

  const { data: tenantsData, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = ((tenantsData ?? []) as { id: string; name: string; logo_url: string | null; cover_image_url: string | null }[])
    .filter((t) => !linkedIds.has(t.id))
    .filter((t) => !categoryTenantIds || categoryTenantIds.has(t.id));

  if (candidates.length === 0) return NextResponse.json({ data: [] });

  // Primary location per candidate (for distance + city).
  const ids = candidates.map((t) => t.id);
  const { data: locs } = await ctx.admin
    .from('tenant_locations')
    .select('tenant_id, address, latitude, longitude')
    .in('tenant_id', ids);
  const locByTenant = new Map<string, { address: string | null; latitude: number | null; longitude: number | null }>();
  for (const l of (locs ?? []) as { tenant_id: string; address: string | null; latitude: number | null; longitude: number | null }[]) {
    if (!locByTenant.has(l.tenant_id)) locByTenant.set(l.tenant_id, l);
  }

  // Category label per candidate (parent preferred).
  const { data: catLinks } = await ctx.admin
    .from('tenant_category_links')
    .select('tenant_id, categories!inner(name, parent_id)')
    .in('tenant_id', ids);
  const catByTenant = new Map<string, string>();
  for (const row of (catLinks ?? []) as { tenant_id: string; categories: { name: string; parent_id: string | null } | { name: string; parent_id: string | null }[] }[]) {
    const c = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (c?.name && (!catByTenant.has(row.tenant_id) || c.parent_id === null)) catByTenant.set(row.tenant_id, c.name);
  }

  const enriched = candidates.map((t) => {
    const loc = locByTenant.get(t.id);
    const distance_km = pLat != null && pLng != null && loc?.latitude != null && loc?.longitude != null
      ? Math.round(haversineKm(pLat, pLng, loc.latitude, loc.longitude) * 10) / 10
      : null;
    return {
      id: t.id,
      name: t.name,
      logo_url: t.logo_url,
      cover_image_url: t.cover_image_url,
      category: catByTenant.get(t.id) ?? null,
      address: loc?.address ?? null,
      distance_km,
    };
  });

  enriched.sort((a, b) => {
    if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km;
    if (a.distance_km != null) return -1;
    if (b.distance_km != null) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ data: enriched.slice(0, limit) });
}
