import { NextResponse } from 'next/server';
import { getOctoContext, OCTO_HEADERS } from '../../../_lib/auth';

export async function OPTIONS() { return new Response(null, { headers: OCTO_HEADERS }); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOctoContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: OCTO_HEADERS });

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { reason?: string };

  const { data: booking } = await ctx.admin
    .from('octo_bookings')
    .select('id, octo_booking_id, appointment_id, status, product_mapping_id, availability_id, contact, unit_items, notes, created_at')
    .eq('octo_booking_id', id)
    .eq('connection_id', ctx.connectionId)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404, headers: OCTO_HEADERS });

  const b = booking as {
    id: string; octo_booking_id: string; appointment_id: string | null;
    status: string; product_mapping_id: string; availability_id: string;
    contact: Record<string, string>; unit_items: unknown[]; notes: string | null; created_at: string;
  };

  if (b.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Booking already cancelled' }, { status: 400, headers: OCTO_HEADERS });
  }

  if (b.appointment_id) {
    await ctx.admin
      .from('appointments')
      .update({ status: 'cancelled' } as never)
      .eq('id', b.appointment_id);
  }

  const now = new Date().toISOString();
  await ctx.admin
    .from('octo_bookings')
    .update({ status: 'CANCELLED', updated_at: now } as never)
    .eq('id', b.id);

  const { data: mapping } = await ctx.admin
    .from('octo_product_mappings')
    .select('octo_product_id')
    .eq('id', b.product_mapping_id)
    .single();

  const productId = (mapping as { octo_product_id: string } | null)?.octo_product_id ?? '';

  return NextResponse.json({
    id: b.octo_booking_id,
    uuid: b.id,
    testMode: false,
    resellerReference: null,
    supplierReference: b.appointment_id,
    status: 'CANCELLED',
    utcCreatedAt: b.created_at,
    utcUpdatedAt: now,
    utcExpiresAt: null,
    utcRedeemedAt: null,
    utcConfirmedAt: null,
    productId,
    optionId: 'DEFAULT',
    cancellable: false,
    cancellation: { reason: body.reason ?? null, utcCancelledAt: now },
    freesale: false,
    availabilityId: b.availability_id,
    contact: b.contact,
    notes: b.notes,
    deliveryMethods: ['VOUCHER'],
    voucher: null,
    unitItems: (b.unit_items as { unitId: string }[]).map((u, i) => ({
      uuid: `${b.id}_${i}`,
      unitId: u.unitId,
      status: 'CANCELLED',
      contact: {},
    })),
  }, { headers: OCTO_HEADERS });
}
