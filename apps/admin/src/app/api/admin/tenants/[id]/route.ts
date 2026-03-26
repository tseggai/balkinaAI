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
      .select('*, subscription_plans(id, name, price_monthly, max_staff, max_locations), categories(id, name)')
      .eq('id', id)
      .single(),

    // 2. Locations
    auth.supabase
      .from('tenant_locations')
      .select('id, name, address, latitude, longitude, timezone, phone, description, image_url, created_at')
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
