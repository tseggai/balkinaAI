import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[bokun-webhook] received:', JSON.stringify(body).slice(0, 500));

  const eventType = (body.event ?? body.type ?? body.action ?? '') as string;
  const bookingId = (body.bookingId ?? body.booking_id ?? body.id ?? '') as string;

  if (!bookingId) {
    return NextResponse.json({ received: true, skipped: 'no bookingId' });
  }

  const { data: existing } = await supabase
    .from('octo_bookings')
    .select('id')
    .eq('octo_booking_id', String(bookingId))
    .maybeSingle();

  if (existing) {
    console.log('[bokun-webhook] booking already tracked:', bookingId);
    return NextResponse.json({ received: true, exists: true });
  }

  const booking = body.booking ?? body;
  const b = booking as Record<string, unknown>;

  const productName = (b.productTitle ?? b.product_title ?? b.experienceTitle ?? '') as string;
  const startTime = (b.startTime ?? b.start_time ?? b.startDate ?? '') as string;
  const endTime = (b.endTime ?? b.end_time ?? b.endDate ?? '') as string;
  const customerName = (b.customerName ?? b.customer_name ??
    ((b.contact as Record<string, unknown> | undefined)?.fullName) ??
    ((b.leadCustomer as Record<string, unknown> | undefined)?.firstName ?? '') + ' ' +
    ((b.leadCustomer as Record<string, unknown> | undefined)?.lastName ?? '')) as string;
  const customerEmail = (b.customerEmail ?? b.customer_email ??
    ((b.contact as Record<string, unknown> | undefined)?.emailAddress) ??
    ((b.leadCustomer as Record<string, unknown> | undefined)?.email ?? '')) as string;
  const customerPhone = (b.customerPhone ?? b.customer_phone ??
    ((b.contact as Record<string, unknown> | undefined)?.phoneNumber) ??
    ((b.leadCustomer as Record<string, unknown> | undefined)?.phoneNumber ?? '')) as string;
  const status = (b.status ?? eventType ?? 'confirmed') as string;
  const totalPrice = Number(b.totalPrice ?? b.total_price ?? b.totalAmount ?? 0);
  const currency = (b.currency ?? 'USD') as string;
  const vendorId = (b.vendorId ?? b.vendor_id ?? '') as string;
  const channelName = (b.channelTitle ?? b.channel ?? b.salesChannel ?? 'Bokun') as string;

  await supabase.from('bokun_webhook_events').insert({
    bokun_booking_id: String(bookingId),
    event_type: eventType || 'booking_confirmed',
    product_name: productName,
    start_time: startTime || null,
    end_time: endTime || null,
    customer_name: customerName.trim() || 'OTA Customer',
    customer_email: customerEmail || null,
    customer_phone: customerPhone || null,
    status: status.toLowerCase(),
    total_price: totalPrice,
    currency,
    vendor_id: vendorId,
    channel_name: channelName,
    raw_payload: body,
    processed: false,
  } as never);

  console.log('[bokun-webhook] stored event:', bookingId, eventType, productName, customerName);

  return NextResponse.json({ received: true, bookingId });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'bokun-webhook' });
}
