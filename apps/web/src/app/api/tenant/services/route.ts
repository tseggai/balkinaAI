import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const [{ data: services }, { data: svcLocs }, { data: extras }, { data: locations }] = await Promise.all([
    ctx.admin.from('services').select('id, name, price, duration_minutes, description, image_url, visibility, deposit_enabled, deposit_amount, deposit_type').eq('tenant_id', ctx.tenantId).order('name'),
    ctx.admin.from('service_locations').select('service_id, location_id'),
    ctx.admin.from('service_extras').select('id, service_id, name, price, duration_minutes'),
    ctx.admin.from('tenant_locations').select('id, name').eq('tenant_id', ctx.tenantId),
  ]);

  const svcIds = new Set(((services ?? []) as { id: string }[]).map(s => s.id));

  const locMap = new Map<string, string[]>();
  for (const sl of (svcLocs ?? []) as { service_id: string; location_id: string }[]) {
    if (!svcIds.has(sl.service_id)) continue;
    const arr = locMap.get(sl.service_id) ?? [];
    arr.push(sl.location_id);
    locMap.set(sl.service_id, arr);
  }

  const extMap = new Map<string, { id: string; name: string; price: number; duration_minutes: number }[]>();
  for (const e of (extras ?? []) as { id: string; service_id: string; name: string; price: number; duration_minutes: number }[]) {
    if (!svcIds.has(e.service_id)) continue;
    const arr = extMap.get(e.service_id) ?? [];
    arr.push({ id: e.id, name: e.name, price: e.price, duration_minutes: e.duration_minutes });
    extMap.set(e.service_id, arr);
  }

  const enriched = ((services ?? []) as Record<string, unknown>[]).map(s => ({
    ...s,
    location_ids: locMap.get(s.id as string) ?? [],
    extras: extMap.get(s.id as string) ?? [],
  }));

  return NextResponse.json({ data: enriched, locations: locations ?? [] }, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await request.json();
  const { data, error } = await ctx.admin
    .from('services')
    .insert({
      tenant_id: ctx.tenantId,
      name: body.name,
      price: body.price ?? 0,
      duration_minutes: body.duration_minutes ?? 60,
      description: body.description || null,
      image_url: body.image_url || null,
      visibility: 'public',
    } as never)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

  const svcId = (data as { id: string }).id;

  // Assign locations
  if (Array.isArray(body.location_ids) && body.location_ids.length > 0) {
    await ctx.admin.from('service_locations').insert(
      body.location_ids.map((lid: string) => ({ service_id: svcId, location_id: lid })) as never[]
    );
  }

  // Add extras
  if (Array.isArray(body.extras) && body.extras.length > 0) {
    await ctx.admin.from('service_extras').insert(
      body.extras.map((e: { name: string; price: number; duration_minutes: number }) => ({
        service_id: svcId, name: e.name, price: e.price ?? 0, duration_minutes: e.duration_minutes ?? 0,
      })) as never[]
    );
  }

  return NextResponse.json({ data: { id: svcId } }, { status: 201, headers: CORS_HEADERS });
}

export async function PATCH(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

  const updates: Record<string, unknown> = {};
  for (const key of ['name', 'price', 'duration_minutes', 'description', 'image_url', 'visibility', 'deposit_enabled', 'deposit_amount', 'deposit_type']) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length > 0) {
    await ctx.admin.from('services').update(updates as never).eq('id', body.id).eq('tenant_id', ctx.tenantId);
  }

  // Update location assignments
  if (Array.isArray(body.location_ids)) {
    await ctx.admin.from('service_locations').delete().eq('service_id', body.id);
    if (body.location_ids.length > 0) {
      await ctx.admin.from('service_locations').insert(
        body.location_ids.map((lid: string) => ({ service_id: body.id, location_id: lid })) as never[]
      );
    }
  }

  // Update extras (replace all)
  if (Array.isArray(body.extras)) {
    await ctx.admin.from('service_extras').delete().eq('service_id', body.id);
    if (body.extras.length > 0) {
      await ctx.admin.from('service_extras').insert(
        body.extras.map((e: { name: string; price: number; duration_minutes: number }) => ({
          service_id: body.id, name: e.name, price: e.price ?? 0, duration_minutes: e.duration_minutes ?? 0,
        })) as never[]
      );
    }
  }

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}

export async function DELETE(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

  await ctx.admin.from('service_locations').delete().eq('service_id', id);
  await ctx.admin.from('service_staff').delete().eq('service_id', id);
  await ctx.admin.from('service_extras').delete().eq('service_id', id);
  await ctx.admin.from('services').delete().eq('id', id).eq('tenant_id', ctx.tenantId);
  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}
