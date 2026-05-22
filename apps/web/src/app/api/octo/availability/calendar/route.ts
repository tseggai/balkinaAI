import { NextResponse } from 'next/server';
import { getOctoContext, OCTO_HEADERS } from '../../_lib/auth';

export async function OPTIONS() { return new Response(null, { headers: OCTO_HEADERS }); }

export async function POST(request: Request) {
  const ctx = await getOctoContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OCTO_HEADERS });

  const body = await request.json() as {
    productId: string;
    optionId?: string;
    localDateStart: string;
    localDateEnd: string;
  };

  const { productId, localDateStart, localDateEnd } = body;
  if (!productId || !localDateStart || !localDateEnd) {
    return NextResponse.json({ error: 'productId, localDateStart, localDateEnd required' }, { status: 400, headers: OCTO_HEADERS });
  }

  const { data: mapping } = await ctx.admin
    .from('octo_product_mappings')
    .select('service_id, services(id, tenant_id)')
    .eq('connection_id', ctx.connectionId)
    .eq('octo_product_id', productId)
    .single();

  if (!mapping) return NextResponse.json({ error: 'Product not found' }, { status: 404, headers: OCTO_HEADERS });

  const m = mapping as unknown as { service_id: string; services: { id: string; tenant_id: string } | null };
  if (!m.services) return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: OCTO_HEADERS });

  const API_BASE = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const startDate = new Date(localDateStart);
  const endDate = new Date(localDateEnd);
  const calendar: { localDate: string; status: string; vacancies: number | null; capacity: number | null; openingHours: unknown[] }[] = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    const res = await fetch(`${API_BASE}/api/booking/staff-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: ctx.tenantId, serviceId: m.services.id, date: dateStr }),
    });

    if (!res.ok) {
      calendar.push({ localDate: dateStr!, status: 'SOLD_OUT', vacancies: 0, capacity: null, openingHours: [] });
      continue;
    }

    const avail = await res.json() as { anyone_slots?: { available: boolean }[] };
    const available = (avail.anyone_slots ?? []).some((s) => s.available);

    calendar.push({
      localDate: dateStr!,
      status: available ? 'AVAILABLE' : 'SOLD_OUT',
      vacancies: available ? 1 : 0,
      capacity: null,
      openingHours: [],
    });
  }

  return NextResponse.json(calendar, { headers: OCTO_HEADERS });
}
