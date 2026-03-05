import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('tenant_locations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const supabase = createAdminClient();

  // Geocode via Google Maps if address provided
  let lat: number | null = (body.lat as number) ?? null;
  let lng: number | null = (body.lng as number) ?? null;
  if (body.address && !lat && !lng) {
    const coords = await geocodeAddress(body.address as string);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  const { data, error } = await supabase
    .from('tenant_locations')
    .insert({
      tenant_id: tenantId,
      name: body.name,
      address: body.address,
      lat,
      lng,
      timezone: body.timezone ?? 'UTC',
      phone: body.phone ?? null,
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      booking_limit_enabled: body.booking_limit_enabled ?? false,
      booking_limit_capacity: body.booking_limit_capacity ?? null,
      booking_limit_interval: body.booking_limit_interval || null,
    } as never)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { id: string; [key: string]: unknown };
  const { id, description: _desc, ...updates } = body;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  // Re-geocode if address changed
  if (updates.address && !updates.lat && !updates.lng) {
    const coords = await geocodeAddress(updates.address as string);
    if (coords) {
      updates.lat = coords.lat;
      updates.lng = coords.lng;
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tenant_locations')
    .update(updates as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function DELETE(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('tenant_locations').delete().eq('id', id).eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`
    );
    const json = await res.json() as { status: string; results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
    if (json.status === 'OK' && json.results?.[0]?.geometry?.location) {
      return json.results[0].geometry.location;
    }
  } catch {
    // Geocoding failure is non-fatal
  }
  return null;
}
