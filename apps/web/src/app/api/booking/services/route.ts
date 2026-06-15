/**
 * GET /api/booking/services
 * Public REST endpoint that lists a tenant's bookable services for the
 * customer-facing storefront (white-label property app). Bypasses OpenAI and
 * auth — returns only public-visibility services.
 *
 * Query params:
 *   tenantId   — single tenant (Business Detail screen)
 *   tenantIds  — comma-separated tenant ids (cross-property sections, e.g. Events strip)
 *   serviceType — optional filter: 'standard' | 'event' | 'table'
 *
 * Returns: { services: [...] }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

const SELECT_COLUMNS =
  'id, tenant_id, name, description, image_url, color, price, pricing_type, ' +
  'duration_minutes, service_type, capacity, deposit_enabled, deposit_type, ' +
  'deposit_amount, hide_price, hide_duration, category_name, timesheet';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const tenantIdsParam = searchParams.get('tenantIds');
    const serviceType = searchParams.get('serviceType');

    const tenantIds = tenantIdsParam
      ? tenantIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : tenantId
        ? [tenantId]
        : [];

    if (tenantIds.length === 0) {
      return NextResponse.json(
        { error: 'tenantId or tenantIds is required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const supabase = createAdminClient();
    let query = supabase
      .from('services')
      .select(SELECT_COLUMNS)
      .in('tenant_id', tenantIds)
      .eq('visibility', 'public')
      .order('name', { ascending: true });

    if (serviceType) {
      query = query.eq('service_type', serviceType);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
    }

    const services = (data ?? []) as unknown as { id: string; service_type?: string; timesheet?: unknown }[];

    // Attach upcoming seatings (service_special_days) to event services so the
    // storefront booking flow can offer dates without a second round-trip.
    const eventIds = services.filter((s) => s.service_type === 'event').map((s) => s.id);
    if (eventIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: days } = await supabase
        .from('service_special_days')
        .select('service_id, date, start_time')
        .in('service_id', eventIds)
        .gte('date', today)
        .order('date', { ascending: true });
      const byService = new Map<string, { date: string; start_time: string | null }[]>();
      for (const d of (days ?? []) as { service_id: string; date: string; start_time: string | null }[]) {
        const arr = byService.get(d.service_id) ?? [];
        arr.push({ date: d.date, start_time: d.start_time });
        byService.set(d.service_id, arr);
      }
      for (const s of services) {
        if (s.service_type === 'event') {
          (s as Record<string, unknown>).event_dates = byService.get(s.id) ?? [];
        }
      }
    }

    return NextResponse.json({ services }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[booking/services] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
