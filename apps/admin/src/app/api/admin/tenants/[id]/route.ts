import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { id } = await params;

  // Fetch all tenant data in parallel
  const [
    tenantResult,
    locationsResult,
    staffResult,
    servicesResult,
    appointmentsResult,
    reviewsResult,
    couponsResult,
    staffLocationsResult,
    serviceStaffResult,
    serviceLocationsResult,
  ] = await Promise.all([
    // 1. Tenant core info
    auth.supabase
      .from('tenants')
      .select('*, subscription_plans(id, name, price_monthly, max_staff, max_locations), categories!category_id(id, name)')
      .eq('id', id)
      .single(),

    // 2. Locations
    auth.supabase
      .from('tenant_locations')
      .select('id, name, address, street_address, address_line2, city, state, postal_code, country, latitude, longitude, timezone, phone, description, image_url, created_at')
      .eq('tenant_id', id)
      .order('name'),

    // 3. Staff
    auth.supabase
      .from('staff')
      .select('id, name, email, phone, image_url, status, requires_approval, created_at')
      .eq('tenant_id', id)
      .order('name'),

    // 4. Services
    auth.supabase
      .from('services')
      .select('id, name, price, duration_minutes, description, image_url, visibility, deposit_enabled, deposit_amount, deposit_type, service_category, service_subcategory, created_at')
      .eq('tenant_id', id)
      .order('name'),

    // 5. Recent appointments (last 50)
    auth.supabase
      .from('appointments')
      .select('id, start_time, end_time, status, total_price, created_at, services(name), staff(name), customers(display_name, email), tenant_locations(name)')
      .eq('tenant_id', id)
      .order('start_time', { ascending: false })
      .limit(50),

    // 6. Reviews
    auth.supabase
      .from('reviews')
      .select('id, rating, comment, created_at, customers(display_name), staff(name)')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(50),

    // 7. Coupons
    auth.supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, expires_at, usage_count, usage_limit, created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false }),

    // 8. Staff-location assignments
    auth.supabase
      .from('staff_locations')
      .select('staff_id, location_id'),

    // 9. Service-staff assignments
    auth.supabase
      .from('service_staff')
      .select('service_id, staff_id'),

    // 10. Service-location assignments
    auth.supabase
      .from('service_locations')
      .select('service_id, location_id'),
  ]);

  if (tenantResult.error) {
    return NextResponse.json({ error: tenantResult.error.message }, { status: 404 });
  }

  // Count distinct customers
  const { count: customerCount } = await auth.supabase
    .from('appointments')
    .select('customer_id', { count: 'exact', head: true })
    .eq('tenant_id', id)
    .not('customer_id', 'is', null);

  // Count total appointments + revenue
  const { data: statsData } = await auth.supabase
    .from('appointments')
    .select('status, total_price')
    .eq('tenant_id', id);

  const stats = {
    total_appointments: (statsData ?? []).length,
    completed_appointments: (statsData ?? []).filter((a: { status: string }) => a.status === 'completed').length,
    total_revenue: (statsData ?? [])
      .filter((a: { status: string }) => a.status === 'completed')
      .reduce((sum: number, a: { total_price: number | null }) => sum + (a.total_price ?? 0), 0),
    pending_appointments: (statsData ?? []).filter((a: { status: string }) => a.status === 'pending').length,
    customer_count: customerCount ?? 0,
    location_count: (locationsResult.data ?? []).length,
    staff_count: (staffResult.data ?? []).length,
    service_count: (servicesResult.data ?? []).length,
    review_count: (reviewsResult.data ?? []).length,
  };

  // Filter staff_locations and service_staff to only this tenant's staff/services
  const tenantStaffIds = new Set(((staffResult.data ?? []) as { id: string }[]).map(s => s.id));
  const tenantServiceIds = new Set(((servicesResult.data ?? []) as { id: string }[]).map(s => s.id));

  const staffLocations = ((staffLocationsResult.data ?? []) as { staff_id: string; location_id: string }[])
    .filter(sl => tenantStaffIds.has(sl.staff_id));
  const serviceStaff = ((serviceStaffResult.data ?? []) as { service_id: string; staff_id: string }[])
    .filter(ss => tenantServiceIds.has(ss.service_id));
  const serviceLocations = ((serviceLocationsResult.data ?? []) as { service_id: string; location_id: string }[])
    .filter(sl => tenantServiceIds.has(sl.service_id));

  return NextResponse.json({
    tenant: tenantResult.data,
    locations: locationsResult.data ?? [],
    staff: staffResult.data ?? [],
    services: servicesResult.data ?? [],
    appointments: appointmentsResult.data ?? [],
    reviews: reviewsResult.data ?? [],
    coupons: couponsResult.data ?? [],
    staff_locations: staffLocations,
    service_staff: serviceStaff,
    service_locations: serviceLocations,
    stats,
  });
}

/**
 * PATCH /api/admin/tenants/[id]
 * Update tenant profile, services, staff, or locations on behalf of the tenant.
 * Body: { tenant?, services?, staff?, locations? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const results: Record<string, unknown> = {};

  // 1. Update tenant profile fields
  if (body.tenant) {
    const allowed = ['name', 'owner_name', 'email', 'phone', 'logo_url', 'category_id', 'status', 'payments_enabled', 'currency'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body.tenant) updates[key] = body.tenant[key];
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await auth.supabase
        .from('tenants')
        .update(updates as never)
        .eq('id', id);
      results.tenant = error ? { error: error.message } : { updated: true };
    }
  }

  // 2. Upsert / delete services
  if (Array.isArray(body.services)) {
    const svcResults: unknown[] = [];
    for (const svc of body.services) {
      if (svc._delete && svc.id) {
        // Delete
        await auth.supabase.from('service_staff').delete().eq('service_id', svc.id);
        await auth.supabase.from('service_locations').delete().eq('service_id', svc.id);
        const { error } = await auth.supabase.from('services').delete().eq('id', svc.id);
        svcResults.push({ id: svc.id, deleted: !error, error: error?.message });
      } else if (svc.id) {
        // Update existing
        const { name, price, duration_minutes, description, image_url, visibility } = svc;
        const { error } = await auth.supabase
          .from('services')
          .update({ name, price, duration_minutes, description, image_url, visibility } as never)
          .eq('id', svc.id);
        svcResults.push({ id: svc.id, updated: !error, error: error?.message });
      } else {
        // Create new
        const { name, price, duration_minutes, description, image_url, visibility } = svc;
        const { data, error } = await auth.supabase
          .from('services')
          .insert({ tenant_id: id, name, price: price ?? 0, duration_minutes: duration_minutes ?? 60, description, image_url, visibility: visibility ?? 'public' } as never)
          .select('id')
          .single();
        svcResults.push({ id: (data as { id: string } | null)?.id, created: !error, error: error?.message });
      }
    }
    results.services = svcResults;
  }

  // 3. Upsert / delete staff
  if (Array.isArray(body.staff)) {
    const staffResults: unknown[] = [];
    for (const s of body.staff) {
      if (s._delete && s.id) {
        await auth.supabase.from('staff_locations').delete().eq('staff_id', s.id);
        await auth.supabase.from('service_staff').delete().eq('staff_id', s.id);
        const { error } = await auth.supabase.from('staff').delete().eq('id', s.id);
        staffResults.push({ id: s.id, deleted: !error, error: error?.message });
      } else if (s.id) {
        const { name, email, phone, image_url, status } = s;
        const { error } = await auth.supabase
          .from('staff')
          .update({ name, email, phone, image_url, status } as never)
          .eq('id', s.id);
        staffResults.push({ id: s.id, updated: !error, error: error?.message });
      } else {
        const { name, email, phone, image_url } = s;
        const { data, error } = await auth.supabase
          .from('staff')
          .insert({ tenant_id: id, name, email, phone, image_url, status: 'active' } as never)
          .select('id')
          .single();
        staffResults.push({ id: (data as { id: string } | null)?.id, created: !error, error: error?.message });
      }
    }
    results.staff = staffResults;
  }

  // 4. Upsert / delete locations
  if (Array.isArray(body.locations)) {
    const locResults: unknown[] = [];
    const allowed = ['name', 'address', 'street_address', 'address_line2', 'city', 'state', 'country', 'postal_code', 'phone', 'description', 'image_url', 'latitude', 'longitude', 'timezone'];
    for (const loc of body.locations) {
      if (loc._delete && loc.id) {
        const { error } = await auth.supabase.from('tenant_locations').delete().eq('id', loc.id);
        locResults.push({ id: loc.id, deleted: !error, error: error?.message });
      } else if (loc.id) {
        // Update existing
        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
          if (key in loc) updates[key] = loc[key];
        }
        if (Object.keys(updates).length > 0) {
          const { error } = await auth.supabase
            .from('tenant_locations')
            .update(updates as never)
            .eq('id', loc.id);
          locResults.push({ id: loc.id, updated: !error, error: error?.message });
        }
      } else {
        // Create new
        const insert: Record<string, unknown> = { tenant_id: id };
        for (const key of allowed) {
          if (key in loc) insert[key] = loc[key];
        }
        if (!insert.name) insert.name = insert.address ?? 'New Location';
        if (!insert.timezone) insert.timezone = 'UTC';
        const { data, error } = await auth.supabase
          .from('tenant_locations')
          .insert(insert as never)
          .select('id')
          .single();
        locResults.push({ id: (data as { id: string } | null)?.id, created: !error, error: error?.message });
      }
    }
    results.locations = locResults;
  }

  return NextResponse.json({ success: true, results });
}
