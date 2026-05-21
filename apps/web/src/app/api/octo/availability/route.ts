import { NextResponse } from 'next/server';
import { getOctoContext, OCTO_HEADERS } from '../_lib/auth';
import { slotToOctoAvailability } from '../_lib/mappers';

export async function OPTIONS() { return new Response(null, { headers: OCTO_HEADERS }); }

export async function POST(request: Request) {
  const ctx = await getOctoContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OCTO_HEADERS });

  const body = await request.json() as {
    productId: string;
    optionId?: string;
    localDateStart: string;
    localDateEnd: string;
    units?: { id: string; quantity: number }[];
  };

  const { productId, localDateStart, localDateEnd } = body;
  if (!productId || !localDateStart || !localDateEnd) {
    return NextResponse.json({ error: 'productId, localDateStart, localDateEnd required' }, { status: 400, headers: OCTO_HEADERS });
  }

  const { data: mapping } = await ctx.admin
    .from('octo_product_mappings')
    .select('service_id, services(id, duration_minutes, tenant_id)')
    .eq('connection_id', ctx.connectionId)
    .eq('octo_product_id', productId)
    .single();

  if (!mapping) return NextResponse.json({ error: 'Product not found' }, { status: 404, headers: OCTO_HEADERS });

  const m = mapping as unknown as { service_id: string; services: { id: string; duration_minutes: number; tenant_id: string } | null };
  if (!m.services) return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: OCTO_HEADERS });

  const startDate = new Date(localDateStart);
  const endDate = new Date(localDateEnd);
  const allSlots: ReturnType<typeof slotToOctoAvailability>[] = [];

  const API_BASE = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    const res = await fetch(`${API_BASE}/api/booking/staff-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: ctx.tenantId,
        serviceId: m.services.id,
        date: dateStr,
      }),
    });

    if (!res.ok) continue;
    const avail = await res.json() as { anyone_slots?: { time: string; iso: string; available: boolean }[] };
    const slots = avail.anyone_slots ?? [];

    for (const slot of slots) {
      allSlots.push(slotToOctoAvailability(slot, productId, m.services.duration_minutes));
    }
  }

  return NextResponse.json(allSlots, { headers: OCTO_HEADERS });
}
