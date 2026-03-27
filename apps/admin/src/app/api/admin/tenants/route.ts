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
  const categoryFilter = searchParams.get('category');
  const cityFilter = searchParams.get('city');
  const sortBy = searchParams.get('sort') ?? 'created_at';
  const sortDir = searchParams.get('dir') === 'asc' ? true : false;

  // If filtering by city, first find tenant IDs that have locations in that city
  let cityTenantIds: string[] | null = null;
  if (cityFilter) {
    const { data: cityLocs } = await auth.supabase
      .from('tenant_locations')
      .select('tenant_id')
      .ilike('city', `%${cityFilter}%`);
    cityTenantIds = [...new Set(((cityLocs ?? []) as { tenant_id: string }[]).map(l => l.tenant_id))];
    if (cityTenantIds.length === 0) {
      const { data: plans } = await auth.supabase.from('subscription_plans').select('id, name').order('name');
      const { data: cats } = await auth.supabase.from('categories').select('id, name').order('name');
      const { data: cities } = await auth.supabase.from('tenant_locations').select('city').not('city', 'is', null);
      const cityNames = [...new Set(((cities ?? []) as { city: string }[]).map(c => c.city))].sort();
      return NextResponse.json({ data: [], total: 0, page, per_page: perPage, plans: plans ?? [], categories: cats ?? [], cities: cityNames });
    }
  }

  const from = (page - 1) * perPage;
  let query = auth.supabase
    .from('tenants')
    .select('id, name, owner_name, email, phone, status, payments_enabled, avg_rating, review_count, logo_url, category_id, created_at, subscription_plan_id, subscription_plans(id, name), categories(id, name)', { count: 'exact' })
    .range(from, from + perPage - 1);

  // Filters
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,owner_name.ilike.%${search}%`);
  if (planFilter) query = query.eq('subscription_plan_id', planFilter);
  if (paymentsFilter === 'true') query = query.eq('payments_enabled', true);
  if (paymentsFilter === 'false') query = query.eq('payments_enabled', false);
  if (categoryFilter) query = query.eq('category_id', categoryFilter);
  if (cityTenantIds) query = query.in('id', cityTenantIds);

  // Sort
  const validSorts = ['created_at', 'name', 'avg_rating', 'review_count', 'status'];
  const sortColumn = validSorts.includes(sortBy) ? sortBy : 'created_at';
  query = query.order(sortColumn, { ascending: sortDir, nullsFirst: false });

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tenants = data ?? [];
  const tenantIds = tenants.map((t: { id: string }) => t.id);

  // Fetch counts and filter options in parallel
  const locationCounts: Record<string, number> = {};
  const staffCounts: Record<string, number> = {};
  const serviceCounts: Record<string, number> = {};
  const tenantCities: Record<string, string[]> = {};

  const [locResult, staffResult, serviceResult, plansResult, catsResult, allLocsResult] = await Promise.all([
    tenantIds.length > 0
      ? auth.supabase.from('tenant_locations').select('tenant_id, city').in('tenant_id', tenantIds)
      : Promise.resolve({ data: [] }),
    tenantIds.length > 0
      ? auth.supabase.from('staff').select('tenant_id').in('tenant_id', tenantIds)
      : Promise.resolve({ data: [] }),
    tenantIds.length > 0
      ? auth.supabase.from('services').select('tenant_id').in('tenant_id', tenantIds)
      : Promise.resolve({ data: [] }),
    auth.supabase.from('subscription_plans').select('id, name').order('name'),
    auth.supabase.from('categories').select('id, name').order('name'),
    auth.supabase.from('tenant_locations').select('city').not('city', 'is', null),
  ]);

  for (const row of ((locResult.data ?? []) as { tenant_id: string; city: string | null }[])) {
    locationCounts[row.tenant_id] = (locationCounts[row.tenant_id] ?? 0) + 1;
    if (row.city) {
      const arr = tenantCities[row.tenant_id] ?? [];
      if (!arr.includes(row.city)) arr.push(row.city);
      tenantCities[row.tenant_id] = arr;
    }
  }
  for (const row of ((staffResult.data ?? []) as { tenant_id: string }[])) {
    staffCounts[row.tenant_id] = (staffCounts[row.tenant_id] ?? 0) + 1;
  }
  for (const row of ((serviceResult.data ?? []) as { tenant_id: string }[])) {
    serviceCounts[row.tenant_id] = (serviceCounts[row.tenant_id] ?? 0) + 1;
  }

  // Build unique city list from all locations
  const cityNames = [...new Set(((allLocsResult.data ?? []) as { city: string }[]).map(c => c.city))].sort();

  const enriched = tenants.map((t: { id: string }) => ({
    ...t,
    location_count: locationCounts[t.id] ?? 0,
    staff_count: staffCounts[t.id] ?? 0,
    service_count: serviceCounts[t.id] ?? 0,
    cities: tenantCities[t.id] ?? [],
  }));

  return NextResponse.json({
    data: enriched,
    total: count ?? 0,
    page,
    per_page: perPage,
    plans: plansResult.data ?? [],
    categories: catsResult.data ?? [],
    cities: cityNames,
  });
}


export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { name, owner_name, email, phone, category_id, subscription_plan_id, status, payments_enabled, location_city, location_country } = body as {
    name: string;
    owner_name: string;
    email: string;
    phone?: string;
    category_id?: string;
    subscription_plan_id?: string;
    status?: string;
    payments_enabled?: boolean;
    location_city?: string;
    location_country?: string;
  };

  if (!name || !owner_name || !email) {
    return NextResponse.json({ error: 'name, owner_name, and email are required' }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    name,
    owner_name,
    email,
    phone: phone || null,
    category_id: category_id || null,
    subscription_plan_id: subscription_plan_id || null,
    status: status || 'active',
    payments_enabled: payments_enabled ?? false,
  };

  const { data, error } = await auth.supabase
    .from('tenants')
    .insert(insert as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally create a location if city provided
  if (location_city && data) {
    const tenantId = (data as { id: string }).id;
    const geocoded = await geocodeCity(location_city, location_country);
    await auth.supabase.from('tenant_locations').insert({
      tenant_id: tenantId,
      name: `${name} - ${location_city}`,
      address: [location_city, location_country].filter(Boolean).join(', '),
      city: location_city,
      country: location_country || null,
      latitude: geocoded?.lat ?? null,
      longitude: geocoded?.lng ?? null,
      timezone: geocoded?.tz ?? 'UTC',
    } as never);
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { id, ...fields } = body as {
    id: string;
    name?: string;
    owner_name?: string;
    email?: string;
    phone?: string;
    status?: string;
    payments_enabled?: boolean;
    category_id?: string | null;
    subscription_plan_id?: string | null;
  };

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const allowedFields = ['name', 'owner_name', 'email', 'phone', 'status', 'payments_enabled', 'category_id', 'subscription_plan_id'];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if ((fields as Record<string, unknown>)[key] !== undefined) {
      updates[key] = (fields as Record<string, unknown>)[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('tenants')
    .update(updates)
    .eq('id', id)
    .select('*, subscription_plans(id, name), categories(id, name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Delete related data in order (respecting foreign keys)
  // service_staff, service_locations, staff_locations -> services, staff, tenant_locations -> tenant
  const { data: services } = await auth.supabase.from('services').select('id').eq('tenant_id', id);
  const serviceIds = ((services ?? []) as { id: string }[]).map(s => s.id);
  const { data: staffRows } = await auth.supabase.from('staff').select('id').eq('tenant_id', id);
  const staffIds = ((staffRows ?? []) as { id: string }[]).map(s => s.id);

  // Junction tables
  if (serviceIds.length > 0) {
    await auth.supabase.from('service_staff').delete().in('service_id', serviceIds);
    await auth.supabase.from('service_locations').delete().in('service_id', serviceIds);
    await auth.supabase.from('service_extras').delete().in('service_id', serviceIds);
  }
  if (staffIds.length > 0) {
    await auth.supabase.from('staff_locations').delete().in('staff_id', staffIds);
  }

  // Main child tables
  await auth.supabase.from('services').delete().eq('tenant_id', id);
  await auth.supabase.from('staff').delete().eq('tenant_id', id);
  await auth.supabase.from('tenant_locations').delete().eq('tenant_id', id);
  await auth.supabase.from('appointments').delete().eq('tenant_id', id);
  await auth.supabase.from('reviews').delete().eq('tenant_id', id);
  await auth.supabase.from('coupons').delete().eq('tenant_id', id);

  // Delete tenant
  const { error } = await auth.supabase.from('tenants').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// Geocode a city name to get lat/lng/timezone using Google Maps API
async function geocodeCity(city: string, country?: string): Promise<{ lat: number; lng: number; tz: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const query = country ? `${city}, ${country}` : city;
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
    );
    const geoJson = await geoRes.json() as { status: string; results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
    if (geoJson.status !== 'OK' || !geoJson.results?.[0]?.geometry?.location) return null;

    const { lat, lng } = geoJson.results[0].geometry.location;

    // Get timezone from coordinates
    const tzRes = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${apiKey}`
    );
    const tzJson = await tzRes.json() as { status: string; timeZoneId?: string };
    const tz = tzJson.status === 'OK' && tzJson.timeZoneId ? tzJson.timeZoneId : 'UTC';

    return { lat, lng, tz };
  } catch {
    return null;
  }
}
