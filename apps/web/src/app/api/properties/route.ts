import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const id = searchParams.get('id');

  if (!slug && !id) {
    return NextResponse.json({ error: 'slug or id required' }, { status: 400, headers: CORS_HEADERS });
  }

  const supabase = createAdminClient();

  let query = supabase
    .from('properties')
    .select('*')
    .eq('is_active', true);

  if (slug) query = query.eq('slug', slug);
  else if (id) query = query.eq('id', id);

  const { data: property, error } = await query.single();
  if (error || !property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404, headers: CORS_HEADERS });
  }

  const p = property as { id: string; [key: string]: unknown };

  const { data: tenantLinks } = await supabase
    .from('property_tenants')
    .select('tenant_id, display_order, featured, tenants(id, name, logo_url, cover_image_url, avg_rating, review_count, description, slug)')
    .eq('property_id', p.id)
    .order('display_order');

  const tenants = ((tenantLinks ?? []) as unknown as {
    tenant_id: string;
    display_order: number;
    featured: boolean;
    tenants: { id: string; name: string; logo_url: string | null; cover_image_url: string | null; avg_rating: number | null; review_count: number | null; description: string | null; slug: string | null } | null;
  }[])
    .filter((tl) => tl.tenants)
    .map((tl) => ({
      id: tl.tenants!.id, // eslint-disable-line
      name: tl.tenants!.name,
      logo_url: tl.tenants!.logo_url,
      cover_image_url: tl.tenants!.cover_image_url,
      avg_rating: tl.tenants!.avg_rating,
      review_count: tl.tenants!.review_count,
      description: tl.tenants!.description,
      slug: tl.tenants!.slug,
      display_order: tl.display_order,
      featured: tl.featured,
    }));

  // Resolve each tenant's category. Businesses are tagged at the parent level
  // ("Health & Wellness") and optionally a child sub-category ("Spa"). The
  // storefront groups by parent `category`; `subcategory` is an optional filter.
  const tenantIds = tenants.map((t) => t.id);
  const { data: catRows } = tenantIds.length > 0
    ? await supabase
        .from('tenant_category_links')
        .select('tenant_id, categories!inner(id, name, parent_id)')
        .in('tenant_id', tenantIds)
    : { data: [] };

  type CatRow = { tenant_id: string; categories: { id: string; name: string; parent_id: string | null } | { id: string; name: string; parent_id: string | null }[] };
  const rows = (catRows ?? []) as CatRow[];

  // Look up parent names for child links so we can derive the parent category.
  const parentIds = new Set<string>();
  for (const row of rows) {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (cat?.parent_id) parentIds.add(cat.parent_id);
  }
  const parentNameById = new Map<string, string>();
  if (parentIds.size > 0) {
    const { data: parents } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', Array.from(parentIds));
    for (const p of (parents ?? []) as { id: string; name: string }[]) parentNameById.set(p.id, p.name);
  }

  const catMap = new Map<string, { category?: string; subcategory?: string }>();
  for (const row of rows) {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (!cat?.name) continue;
    const entry = catMap.get(row.tenant_id) ?? {};
    if (cat.parent_id) {
      entry.subcategory = entry.subcategory ?? cat.name;
      entry.category = entry.category ?? parentNameById.get(cat.parent_id);
    } else {
      entry.category = entry.category ?? cat.name;
    }
    catMap.set(row.tenant_id, entry);
  }

  const enrichedTenants = tenants.map((t) => ({
    ...t,
    category: catMap.get(t.id)?.category ?? undefined,
    subcategory: catMap.get(t.id)?.subcategory ?? undefined,
  }));

  // Active campaigns (running or upcoming) for the storefront strip.
  const nowIso = new Date().toISOString();
  const { data: campaignRows } = await supabase
    .from('property_campaigns')
    .select('id, title, blurb, description, image_url, campaign_type, starts_at, ends_at, location, is_property_only, cta_label, cta_url, cta_type, cta_fields')
    .eq('property_id', (property as { id: string }).id)
    .eq('is_active', true)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('display_order', { ascending: true })
    .order('starts_at', { ascending: true });

  const campaigns = (campaignRows ?? []) as { id: string }[];
  const campIds = campaigns.map((c) => c.id);
  const campTenants = new Map<string, string[]>();
  if (campIds.length > 0) {
    const { data: ctRows } = await supabase
      .from('campaign_tenants')
      .select('campaign_id, tenant_id')
      .in('campaign_id', campIds);
    for (const r of (ctRows ?? []) as { campaign_id: string; tenant_id: string }[]) {
      const arr = campTenants.get(r.campaign_id) ?? [];
      arr.push(r.tenant_id);
      campTenants.set(r.campaign_id, arr);
    }
  }

  return NextResponse.json({
    property,
    tenants: enrichedTenants,
    campaigns: campaigns.map((c) => ({ ...c, tenant_ids: campTenants.get(c.id) ?? [] })),
  }, { headers: CORS_HEADERS });
}
