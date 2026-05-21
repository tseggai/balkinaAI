import { NextResponse } from 'next/server';
import { getOctoContext, OCTO_HEADERS } from '../../../_lib/auth';
import { parseAvailabilityId } from '../../../_lib/mappers';

export async function OPTIONS() { return new Response(null, { headers: OCTO_HEADERS }); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOctoContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OCTO_HEADERS });

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as {
    resellerReference?: string;
    contact?: { fullName?: string; emailAddress?: string; phoneNumber?: string };
    notes?: string;
  };

  const { data: booking } = await ctx.admin
    .from('octo_bookings')
    .select('id, octo_booking_id, connection_id, product_mapping_id, availability_id, contact, unit_items, notes, status')
    .eq('octo_booking_id', id)
    .eq('connection_id', ctx.connectionId)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404, headers: OCTO_HEADERS });

  const b = booking as {
    id: string; octo_booking_id: string; product_mapping_id: string;
    availability_id: string; contact: Record<string, string>; unit_items: unknown[];
    notes: string | null; status: string;
  };

  if (b.status !== 'ON_HOLD') {
    return NextResponse.json({ error: `Booking is ${b.status}, cannot confirm` }, { status: 400, headers: OCTO_HEADERS });
  }

  const parsed = parseAvailabilityId(b.availability_id);
  if (!parsed) return NextResponse.json({ error: 'Invalid availability' }, { status: 400, headers: OCTO_HEADERS });

  const { data: mapping } = await ctx.admin
    .from('octo_product_mappings')
    .select('service_id, octo_product_id')
    .eq('id', b.product_mapping_id)
    .single();

  if (!mapping) return NextResponse.json({ error: 'Product mapping not found' }, { status: 404, headers: OCTO_HEADERS });
  const m = mapping as { service_id: string; octo_product_id: string };

  const contact = { ...b.contact, ...body.contact };
  const startTime = new Date(parsed.isoStart);
  const dateStr = startTime.toISOString().split('T')[0];
  const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const API_BASE = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const createRes = await fetch(`${API_BASE}/api/booking/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: ctx.tenantId,
      serviceId: m.service_id,
      date: dateStr,
      timeSlot: timeStr,
      timeSlotIso: parsed.isoStart,
      customerName: contact.fullName ?? 'OTA Customer',
      customerPhone: contact.phoneNumber ?? '',
      customerEmail: contact.emailAddress ?? '',
    }),
  });

  const createData = await createRes.json() as { success?: boolean; appointment_id?: string; error?: string };

  if (!createRes.ok || !createData.success) {
    return NextResponse.json({ error: createData.error ?? 'Failed to create booking' }, { status: 409, headers: OCTO_HEADERS });
  }

  const now = new Date().toISOString();
  await ctx.admin
    .from('octo_bookings')
    .update({
      status: 'CONFIRMED',
      appointment_id: createData.appointment_id,
      contact,
      notes: body.notes ?? b.notes,
      updated_at: now,
    } as never)
    .eq('id', b.id);

  if (createData.appointment_id) {
    await ctx.admin
      .from('appointments')
      .update({ booking_source: 'octo', octo_booking_id: b.octo_booking_id } as never)
      .eq('id', createData.appointment_id);
  }

  return NextResponse.json({
    id: b.octo_booking_id,
    uuid: b.id,
    testMode: false,
    resellerReference: body.resellerReference ?? null,
    supplierReference: createData.appointment_id ?? null,
    status: 'CONFIRMED',
    utcCreatedAt: now,
    utcUpdatedAt: now,
    utcExpiresAt: null,
    utcRedeemedAt: null,
    utcConfirmedAt: now,
    productId: m.octo_product_id,
    optionId: 'DEFAULT',
    cancellable: true,
    cancellation: null,
    freesale: false,
    availabilityId: b.availability_id,
    availability: {
      id: b.availability_id,
      localDateTimeStart: parsed.isoStart,
      localDateTimeEnd: new Date(startTime.getTime() + 60 * 60000).toISOString(),
      allDay: false,
      openingHours: [],
    },
    contact,
    notes: body.notes ?? b.notes ?? null,
    deliveryMethods: ['VOUCHER'],
    voucher: null,
    unitItems: (b.unit_items as { unitId: string }[]).map((u, i) => ({
      uuid: `${b.id}_${i}`,
      unitId: u.unitId,
      status: 'CONFIRMED',
      contact: {},
    })),
  }, { headers: OCTO_HEADERS });
}
