import { NextResponse } from 'next/server';
import { getOctoContext, OCTO_HEADERS } from '../../_lib/auth';
import { serviceToOctoProduct } from '../../_lib/mappers';

export async function OPTIONS() { return new Response(null, { headers: OCTO_HEADERS }); }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOctoContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OCTO_HEADERS });

  const { id } = await params;

  const { data: mapping } = await ctx.admin
    .from('octo_product_mappings')
    .select('octo_product_id, services(id, name, duration_minutes, price, pricing_type)')
    .eq('connection_id', ctx.connectionId)
    .eq('octo_product_id', id)
    .eq('is_active', true)
    .single();

  if (!mapping) return NextResponse.json({ error: 'Product not found' }, { status: 404, headers: OCTO_HEADERS });

  const m = mapping as unknown as { octo_product_id: string; services: { id: string; name: string; duration_minutes: number; price: number; pricing_type: string } | null };
  if (!m.services) return NextResponse.json({ error: 'Product not found' }, { status: 404, headers: OCTO_HEADERS });

  const { data: loc } = await ctx.admin
    .from('tenant_locations')
    .select('timezone, currency')
    .eq('tenant_id', ctx.tenantId)
    .limit(1)
    .single();

  const timezone = (loc as { timezone: string } | null)?.timezone ?? 'UTC';
  const currency = (loc as { currency: string } | null)?.currency ?? 'USD';

  const step = Math.max(m.services.duration_minutes, 30);
  const startTimes: string[] = [];
  for (let min = 9 * 60; min < 17 * 60; min += step) {
    startTimes.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
  }

  return NextResponse.json(
    serviceToOctoProduct(m.services, m.octo_product_id, timezone, currency, startTimes),
    { headers: OCTO_HEADERS },
  );
}
