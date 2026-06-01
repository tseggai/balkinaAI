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
    .select('tenant_id, display_order, featured, tenants(id, name, logo_url, avg_rating, review_count, description, slug)')
    .eq('property_id', p.id)
    .order('display_order');

  const tenants = ((tenantLinks ?? []) as unknown as {
    tenant_id: string;
    display_order: number;
    featured: boolean;
    tenants: { id: string; name: string; logo_url: string | null; avg_rating: number | null; review_count: number | null; description: string | null; slug: string | null } | null;
  }[])
    .filter((tl) => tl.tenants)
    .map((tl) => ({
      id: tl.tenants!.id, // eslint-disable-line
      name: tl.tenants!.name,
      logo_url: tl.tenants!.logo_url,
      avg_rating: tl.tenants!.avg_rating,
      review_count: tl.tenants!.review_count,
      description: tl.tenants!.description,
      slug: tl.tenants!.slug,
      display_order: tl.display_order,
      featured: tl.featured,
    }));

  // Get subcategories for each tenant
  const tenantIds = tenants.map((t) => t.id);
  const { data: subcatRows } = tenantIds.length > 0
    ? await supabase
        .from('tenant_category_links')
        .select('tenant_id, categories!inner(name, parent_id)')
        .in('tenant_id', tenantIds)
        .not('categories.parent_id', 'is', null)
    : { data: [] };

  const subcatMap = new Map<string, string>();
  for (const row of (subcatRows ?? []) as { tenant_id: string; categories: { name: string } | { name: string }[] }[]) {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (cat?.name && !subcatMap.has(row.tenant_id)) {
      subcatMap.set(row.tenant_id, cat.name);
    }
  }

  const enrichedTenants = tenants.map((t) => ({
    ...t,
    subcategory: subcatMap.get(t.id) ?? undefined,
  }));

  return NextResponse.json({
    property,
    tenants: enrichedTenants,
  }, { headers: CORS_HEADERS });
}
