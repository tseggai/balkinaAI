import { NextResponse } from 'next/server';
import { getOctoContext, OCTO_HEADERS } from '../_lib/auth';
import { parseAvailabilityId } from '../_lib/mappers';
import crypto from 'crypto';

export async function OPTIONS() { return new Response(null, { headers: OCTO_HEADERS }); }

export async function POST(request: Request) {
  const ctx = await getOctoContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OCTO_HEADERS });

  const body = await request.json() as {
    productId: string;
    optionId?: string;
    availabilityId: string;
    unitItems: { unitId: string }[];
    resellerReference?: string;
    contact?: { fullName?: string; emailAddress?: string; phoneNumber?: string };
    notes?: string;
  };

  const { productId, availabilityId, unitItems, contact, notes, resellerReference } = body;
  if (!productId || !availabilityId) {
    return NextResponse.json({ error: 'productId and availabilityId required' }, { status: 400, headers: OCTO_HEADERS });
  }

  const { data: mapping } = await ctx.admin
    .from('octo_product_mappings')
    .select('id, service_id')
    .eq('connection_id', ctx.connectionId)
    .eq('octo_product_id', productId)
    .single();

  if (!mapping) return NextResponse.json({ error: 'Product not found' }, { status: 404, headers: OCTO_HEADERS });

  const m = mapping as { id: string; service_id: string };
  const parsed = parseAvailabilityId(availabilityId);
  if (!parsed) return NextResponse.json({ error: 'Invalid availabilityId' }, { status: 400, headers: OCTO_HEADERS });

  const octoBookingId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60000);

  const { data: booking, error } = await ctx.admin
    .from('octo_bookings')
    .insert({
      connection_id: ctx.connectionId,
      octo_booking_id: octoBookingId,
      status: 'ON_HOLD',
      product_mapping_id: m.id,
      availability_id: availabilityId,
      unit_items: unitItems ?? [],
      contact: contact ?? {},
      notes: notes ?? null,
      expires_at: expiresAt.toISOString(),
    } as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: OCTO_HEADERS });

  const b = booking as { id: string; octo_booking_id: string; created_at: string };
  const startTime = new Date(parsed.isoStart);
  const endTime = new Date(startTime.getTime() + 60 * 60000);

  return NextResponse.json({
    id: b.octo_booking_id,
    uuid: b.id,
    testMode: false,
    resellerReference: resellerReference ?? null,
    supplierReference: null,
    status: 'ON_HOLD',
    utcCreatedAt: b.created_at,
    utcUpdatedAt: b.created_at,
    utcExpiresAt: expiresAt.toISOString(),
    utcRedeemedAt: null,
    utcConfirmedAt: null,
    productId,
    optionId: 'DEFAULT',
    cancellable: true,
    cancellation: null,
    freesale: false,
    availabilityId,
    availability: {
      id: availabilityId,
      localDateTimeStart: startTime.toISOString(),
      localDateTimeEnd: endTime.toISOString(),
      allDay: false,
      openingHours: [],
    },
    contact: contact ?? {},
    notes: notes ?? null,
    deliveryMethods: ['VOUCHER'],
    voucher: null,
    unitItems: (unitItems ?? []).map((u, i) => ({
      uuid: `${b.id}_${i}`,
      unitId: u.unitId,
      status: 'ON_HOLD',
      contact: {},
    })),
  }, { status: 201, headers: OCTO_HEADERS });
}
