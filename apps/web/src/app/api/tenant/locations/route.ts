import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { data, error } = await ctx.admin
    .from('tenant_locations')
    .select('id, name, address, street_address, city, state, country, postal_code, latitude, longitude, timezone, phone, description, image_url')
    .eq('tenant_id', ctx.tenantId)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

  // Also fetch gallery counts per location
  const locIds = ((data ?? []) as { id: string }[]).map(l => l.id);
  const galleryCounts = new Map<string, number>();
  if (locIds.length > 0) {
    const { data: gallery } = await ctx.admin
      .from('location_gallery')
      .select('location_id')
      .in('location_id', locIds);
    for (const g of (gallery ?? []) as { location_id: string }[]) {
      galleryCounts.set(g.location_id, (galleryCounts.get(g.location_id) ?? 0) + 1);
    }
  }

  const enriched = ((data ?? []) as Record<string, unknown>[]).map(l => ({
    ...l,
    gallery_count: galleryCounts.get(l.id as string) ?? 0,
  }));

  return NextResponse.json({ data: enriched }, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await request.json();
  const { data, error } = await ctx.admin
    .from('tenant_locations')
    .insert({
      tenant_id: ctx.tenantId,
      name: body.name || 'New Location',
      address: body.address || '',
      street_address: body.street_address || null,
      city: body.city || null,
      state: body.state || null,
      country: body.country || null,
      postal_code: body.postal_code || null,
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      timezone: body.timezone || 'Europe/Podgorica',
      phone: body.phone || null,
      description: body.description || null,
    } as never)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json({ data }, { status: 201, headers: CORS_HEADERS });
}

export async function PATCH(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

  const allowed = ['name', 'address', 'street_address', 'city', 'state', 'country', 'postal_code', 'latitude', 'longitude', 'timezone', 'phone', 'description', 'image_url'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { error } = await ctx.admin
    .from('tenant_locations')
    .update(updates as never)
    .eq('id', body.id)
    .eq('tenant_id', ctx.tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}

export async function DELETE(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

  const { error } = await ctx.admin.from('tenant_locations').delete().eq('id', id).eq('tenant_id', ctx.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}
