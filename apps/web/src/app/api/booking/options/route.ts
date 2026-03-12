/**
 * POST /api/booking/options
 * Direct REST endpoint for client-side booking flow (Phase 2).
 * Returns packages + service extras — no GPT involvement.
 *
 * Body: { tenantId, serviceId, customerId? }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenantId: string;
      serviceId: string;
      customerId?: string;
    };

    const { tenantId, serviceId, customerId } = body;

    if (!tenantId || !serviceId) {
      return NextResponse.json({ error: 'tenantId and serviceId are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Run all queries in parallel
    const [serviceResult, packagesResult, customerPackagesResult] = await Promise.all([
      // Service details with extras and staff
      (async () => {
        const { data, error } = await supabase
          .from('services')
          .select('*, service_extras(*), categories(name)')
          .eq('id', serviceId)
          .single();
        if (error) return { data: null, error };

        const { data: staffData } = await supabase
          .from('service_staff')
          .select('staff:staff_id(id, name, image_url)')
          .eq('service_id', serviceId);

        const assignedStaff = ((staffData ?? []) as unknown as { staff: { id: string; name: string; image_url: string | null } | null }[])
          .map((ss) => ss.staff)
          .filter(Boolean);

        return { data: { ...data, available_staff: assignedStaff }, error: null };
      })(),

      // Available packages for this tenant+service
      (async () => {
        const { data, error } = await supabase
          .from('packages')
          .select('*, package_services(quantity, service_id, services(name, price, duration_minutes))')
          .eq('tenant_id', tenantId)
          .eq('is_active', true);
        if (error) return { data: [], error };

        const filtered = ((data ?? []) as { id: string; package_services: { service_id: string; quantity: number; services: { name: string } | null }[]; [key: string]: unknown }[])
          .filter((pkg) => pkg.package_services?.some((ps) => ps.service_id === serviceId));

        return { data: filtered, error: null };
      })(),

      // Customer-owned packages
      (async () => {
        if (!customerId) return { data: [], error: null };
        const { data, error } = await supabase
          .from('customer_packages')
          .select('*, package:packages(name, price), sessions:customer_package_services(service_id, sessions_remaining, services(name))')
          .eq('customer_id', customerId)
          .eq('tenant_id', tenantId)
          .gt('expires_at', new Date().toISOString());
        if (error) return { data: [], error };

        const filtered = ((data ?? []) as { sessions: { service_id: string; sessions_remaining: number }[]; [key: string]: unknown }[])
          .filter((cp) => cp.sessions?.some((s) => s.service_id === serviceId && s.sessions_remaining > 0));

        return { data: filtered, error: null };
      })(),
    ]);

    if (serviceResult.error || !serviceResult.data) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const serviceData = serviceResult.data as Record<string, unknown> & {
      service_extras: { id: string; name: string; price: number; duration_minutes: number }[];
    };

    return NextResponse.json({
      service: serviceResult.data,
      packages: packagesResult.data ?? [],
      customer_packages: customerPackagesResult.data ?? [],
      extras: serviceData.service_extras ?? [],
    });
  } catch (err) {
    console.error('[booking/options] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
