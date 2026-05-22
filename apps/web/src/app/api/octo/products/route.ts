import { NextResponse } from 'next/server';
import { getOctoContext, OCTO_HEADERS } from '../_lib/auth';
import { serviceToOctoProduct } from '../_lib/mappers';

export async function OPTIONS() { return new Response(null, { headers: OCTO_HEADERS }); }

export async function GET(request: Request) {
  const ctx = await getOctoContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OCTO_HEADERS });

  const { data: mappings } = await ctx.admin
    .from('octo_product_mappings')
    .select('octo_product_id, octo_option_id, service_id, services(id, name, duration_minutes, price, pricing_type)')
    .eq('connection_id', ctx.connectionId)
    .eq('is_active', true);

  const { data: loc } = await ctx.admin
    .from('tenant_locations')
    .select('timezone, currency')
    .eq('tenant_id', ctx.tenantId)
    .limit(1)
    .single();

  const timezone = (loc as { timezone: string } | null)?.timezone ?? 'UTC';
  const currency = (loc as { currency: string } | null)?.currency ?? 'USD';

  const products = ((mappings ?? []) as unknown as {
    octo_product_id: string;
    service_id: string;
    services: { id: string; name: string; duration_minutes: number; price: number; pricing_type: string } | null;
  }[])
    .filter((m) => m.services)
    .map((m) => {
      const svc = m.services!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      const startTimes = generateStartTimes(svc.duration_minutes);
      return serviceToOctoProduct(svc, m.octo_product_id, timezone, currency, startTimes);
    });

  return NextResponse.json(products, { headers: OCTO_HEADERS });
}

function generateStartTimes(durationMinutes: number): string[] {
  const times: string[] = [];
  const step = Math.max(durationMinutes, 30);
  for (let m = 9 * 60; m < 17 * 60; m += step) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const min = String(m % 60).padStart(2, '0');
    times.push(`${h}:${min}`);
  }
  return times;
}
