import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface BokunPayload {
  bookingId: number;
  status: string;
  currency: string;
  totalPrice: number;
  seller: { id: number; title: string; timeZone: string; currencyCode: string };
  customer: { firstName: string; lastName: string; email: string; phoneNumber: string | null };
  activityBookings: {
    title: string;
    status: string;
    startTime: string;
    startDateTime: number;
    endDateTime: number;
    date: number;
    productId: number;
    product: { id: number; title: string; vendor: { id: number } };
    totalPrice: number;
  }[];
  bookingChannel: { title: string };
}

export async function POST(request: Request) {
  const supabase = createAdminClient();

  let body: BokunPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const bookingId = String(body.bookingId ?? '');
  if (!bookingId) return NextResponse.json({ received: true, skipped: 'no bookingId' });

  const vendorId = String(body.seller?.id ?? '');
  const status = (body.status ?? '').toUpperCase();
  const customer = body.customer ?? { firstName: '', lastName: '', email: '', phoneNumber: null };
  const customerName = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || 'OTA Customer';
  const customerEmail = customer.email || null;
  const customerPhone = customer.phoneNumber || null;
  const currency = body.currency ?? body.seller?.currencyCode ?? 'USD';
  const channelName = body.bookingChannel?.title ?? 'Bokun';
  const activity = body.activityBookings?.[0];
  const productName = activity?.title ?? activity?.product?.title ?? '';
  const totalPrice = body.totalPrice ?? activity?.totalPrice ?? 0;

  let startTime: string | null = null;
  let endTime: string | null = null;
  if (activity?.startDateTime) {
    startTime = new Date(activity.startDateTime).toISOString();
    endTime = activity.endDateTime ? new Date(activity.endDateTime).toISOString() : null;
  }

  const { data: existing } = await supabase
    .from('bokun_webhook_events')
    .select('id, status')
    .eq('bokun_booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && (existing as { status: string }).status === status.toLowerCase()) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const { data: event } = await supabase.from('bokun_webhook_events').insert({
    bokun_booking_id: bookingId,
    event_type: status === 'CANCELLED' ? 'booking_cancelled' : 'booking_confirmed',
    product_name: productName,
    start_time: startTime,
    end_time: endTime,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    status: status.toLowerCase(),
    total_price: totalPrice,
    currency,
    vendor_id: vendorId,
    channel_name: channelName,
    raw_payload: body,
    processed: false,
  } as never).select('id').single();

  const eventId = (event as { id: string } | null)?.id;

  if (status === 'CONFIRMED' && vendorId && startTime && productName) {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('bokun_vendor_id', vendorId)
        .single();

      if (tenant) {
        const tenantId = (tenant as { id: string }).id;

        const { data: service } = await supabase
          .from('services')
          .select('id, duration_minutes')
          .eq('tenant_id', tenantId)
          .ilike('name', productName)
          .limit(1)
          .maybeSingle();

        const serviceId = (service as { id: string; duration_minutes: number } | null)?.id;
        const duration = (service as { id: string; duration_minutes: number } | null)?.duration_minutes ?? 60;

        const computedEnd = endTime ?? new Date(new Date(startTime).getTime() + duration * 60000).toISOString();

        const { data: loc } = await supabase
          .from('tenant_locations')
          .select('id')
          .eq('tenant_id', tenantId)
          .limit(1)
          .maybeSingle();
        const locationId = (loc as { id: string } | null)?.id ?? null;

        let customerId: string | null = null;
        if (customerEmail) {
          const { data: existingCust } = await supabase
            .from('customers')
            .select('id')
            .eq('email', customerEmail)
            .limit(1)
            .maybeSingle();

          if (existingCust) {
            customerId = (existingCust as { id: string }).id;
          } else {
            const fakeEmail = `bokun_${bookingId}@ota.balkina.ai`;
            const { data: authUser } = await supabase.auth.admin.createUser({
              email: fakeEmail, email_confirm: true,
              user_metadata: { display_name: customerName, source: 'bokun_ota' },
            });
            if (authUser?.user) {
              customerId = authUser.user.id;
              await supabase.from('customers').insert({
                id: customerId,
                display_name: customerName,
                email: customerEmail,
                phone: customerPhone ?? '',
              } as never);
            }
          }
        }

        if (customerId) {
          const { data: appt } = await supabase.from('appointments').insert({
            tenant_id: tenantId,
            customer_id: customerId,
            service_id: serviceId,
            location_id: locationId,
            start_time: startTime,
            end_time: computedEnd,
            status: 'confirmed',
            total_price: totalPrice,
            booking_source: 'bokun',
            octo_booking_id: bookingId,
            notes: `OTA booking via ${channelName} — ${productName}`,
          } as never).select('id').single();

          if (appt && eventId) {
            const apptId = (appt as { id: string }).id;
            await supabase.from('bokun_webhook_events')
              .update({ processed: true, appointment_id: apptId } as never)
              .eq('id', eventId);
          }
        }
      }
    } catch (err) {
      console.error('[bokun-webhook] error creating appointment:', err);
    }
  }

  if (status === 'CANCELLED') {
    const { data: prev } = await supabase
      .from('bokun_webhook_events')
      .select('appointment_id')
      .eq('bokun_booking_id', bookingId)
      .not('appointment_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (prev) {
      const apptId = (prev as { appointment_id: string }).appointment_id;
      await supabase.from('appointments')
        .update({ status: 'cancelled' } as never)
        .eq('id', apptId);

      if (eventId) {
        await supabase.from('bokun_webhook_events')
          .update({ processed: true, appointment_id: apptId } as never)
          .eq('id', eventId);
      }
    }
  }

  return NextResponse.json({ received: true, bookingId, status: status.toLowerCase() });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'bokun-webhook' });
}
