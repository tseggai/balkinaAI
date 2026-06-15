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
  'deposit_amount, hide_price, hide_duration, category_name';

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

    return NextResponse.json({ services: data ?? [] }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[booking/services] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
