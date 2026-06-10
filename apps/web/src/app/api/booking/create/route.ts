/**
 * POST /api/booking/create
 * Direct REST endpoint for client-side booking (Phase 2).
 * Creates an appointment without going through GPT.
 *
 * Body: { tenantId, serviceId, staffId?, date, timeSlot, timeSlotIso?, extras?, packageName?, userId?, customerName?, customerPhone?, customerEmail? }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyBookingConfirmed, notifyBookingSubmitted, notifyStaffNewBooking } from '@/lib/notifications/booking-events';
import { pushEventToGoogleCalendar } from '@/lib/google-calendar';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

interface CreateBookingBody {
  tenantId: string;
  locationId?: string;
  serviceId: string;
  staffId?: string;
  staffName?: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // "10:00 AM"
  timeSlotIso?: string; // ISO 8601
  extras?: string[]; // extra names (not IDs)
  packageName?: string;
  userId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  partySize?: number; // number of guests (restaurant table/event/private dining)
  bookingType?: 'service' | 'table' | 'event' | 'private_dining';
}

/**
 * Convert local time string (e.g. "10:00 AM") + date (YYYY-MM-DD) to UTC Date
 * using tenant timezone.
 */
function localTimeToUTC(date: string, time12h: string, timezone: string): Date {
  // Parse "10:00 AM" or "2:30 PM" format
  const match = time12h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    throw new Error(`Invalid time format: ${time12h}`);
  }
  let hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  const meridiem = match[3]!.toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');

  // Create a date string in the tenant's local timezone and convert to UTC
  const localStr = `${date}T${hh}:${mm}:00`;

  // Use Intl to find the UTC offset for this timezone at this date
  const tempDate = new Date(`${localStr}Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(tempDate);
  const tzYear = parts.find((p) => p.type === 'year')!.value;
  const tzMonth = parts.find((p) => p.type === 'month')!.value;
  const tzDay = parts.find((p) => p.type === 'day')!.value;
  const tzHour = parts.find((p) => p.type === 'hour')!.value;
  const tzMinute = parts.find((p) => p.type === 'minute')!.value;

  // The difference between what we want (localStr) and what the timezone shows (tz*) gives us the offset
  const wantedMs = new Date(`${date}T${hh}:${mm}:00Z`).getTime();
  const shownMs = new Date(`${tzYear}-${tzMonth}-${tzDay}T${tzHour}:${tzMinute}:00Z`).getTime();
  const offsetMs = shownMs - wantedMs;

  return new Date(wantedMs - offsetMs);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBookingBody;
    const { tenantId, locationId: requestedLocationId, serviceId, staffId, date, timeSlot, timeSlotIso, extras, packageName, userId, customerName, customerPhone, customerEmail } = body;
    let bookingType = body.bookingType ?? 'service';
    const partySize = body.partySize && body.partySize > 0 ? body.partySize : null;

    if (!tenantId || !serviceId || !date || !timeSlot) {
      return NextResponse.json(
        { error: 'tenantId, serviceId, date, and timeSlot are required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const supabase = createAdminClient();

    // ── Phase 3: Parallel initial queries ──────────────────────────────────────
    // Service, customer, location, staff, and tenant name are all independent.
    const [serviceResult, customerResult, locationResult, staffResult, tenantResult] = await Promise.all([
      // 1. Service details
      supabase.from('services').select('*').eq('id', serviceId).single(),

      // 4. Find or create customer
      (async () => {
        // Helper: fill in missing fields on existing customer — never overwrite phone/email set by tenant
        const patchExisting = async (id: string) => {
          const { data: existing } = await supabase.from('customers').select('phone, email, user_id').eq('id', id).single();
          const cur = existing as { phone: string | null; email: string | null; user_id: string | null } | null;
          const updates: Record<string, string> = {};
          if (customerName) updates.display_name = customerName;
          if (customerPhone && !cur?.phone) updates.phone = customerPhone;
          if (customerEmail && !cur?.email) updates.email = customerEmail;
          if (userId && !cur?.user_id) updates.user_id = userId;
          if (Object.keys(updates).length > 0) {
            await supabase.from('customers').update(updates as never).eq('id', id);
          }
        };

        if (userId) {
          // Try user_id first, then try id = userId (for customers where id matches auth user id)
          const { data } = await supabase.from('customers').select('id').eq('user_id', userId).limit(1).maybeSingle();
          if (data) {
            await patchExisting((data as { id: string }).id);
            return { id: (data as { id: string }).id, error: null };
          }
          const { data: byId } = await supabase.from('customers').select('id').eq('id', userId).limit(1).maybeSingle();
          if (byId) {
            await patchExisting((byId as { id: string }).id);
            return { id: (byId as { id: string }).id, error: null };
          }
        }
        if (customerEmail) {
          const { data } = await supabase.from('customers').select('id').eq('email', customerEmail).limit(1).maybeSingle();
          if (data) {
            await patchExisting((data as { id: string }).id);
            return { id: (data as { id: string }).id, error: null };
          }
        }
        if (customerPhone) {
          const { data } = await supabase.from('customers').select('id').eq('phone', customerPhone).limit(1).maybeSingle();
          if (data) {
            await patchExisting((data as { id: string }).id);
            return { id: (data as { id: string }).id, error: null };
          }
        }
        const email = `chat_${Date.now()}@widget.balkina.ai`;
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email, email_confirm: true,
          user_metadata: { display_name: customerName ?? 'Guest', source: 'chat_widget' },
        });
        if (authErr || !authUser.user) return { id: null, error: authErr?.message ?? 'Unknown' };
        await supabase.from('customers').insert({
          id: authUser.user.id, display_name: customerName, phone: customerPhone,
          email: customerEmail ?? null, user_id: userId ?? null,
        } as never);
        return { id: authUser.user.id, error: null };
      })(),

      // 5. Location (includes timezone, address, coordinates)
      // Use the specific location from the booking flow if provided, otherwise first location
      requestedLocationId
        ? supabase.from('tenant_locations').select('id, address, latitude, longitude, timezone, currency')
            .eq('id', requestedLocationId).limit(1)
        : supabase.from('tenant_locations').select('id, address, latitude, longitude, timezone, currency')
            .eq('tenant_id', tenantId).limit(1),

      // 6. Staff — prefer service_staff assignment over random tenant staff
      (async (): Promise<{ id: string | null; name: string | null; requiresApproval: boolean }> => {
        if (staffId) {
          const { data } = await supabase.from('staff').select('id, name, requires_approval').eq('id', staffId).single();
          const s = data as { id: string; name: string; requires_approval: boolean } | null;
          return { id: s?.id ?? staffId, name: body.staffName || s?.name || null, requiresApproval: s?.requires_approval ?? false };
        }
        // Get all staff assigned to this service via service_staff junction
        const { data: serviceStaff } = await supabase
          .from('service_staff')
          .select('staff:staff_id(id, name, requires_approval)')
          .eq('service_id', serviceId);
        const allAssigned = (serviceStaff as unknown as { staff: { id: string; name: string; requires_approval: boolean } | null }[] | null)
          ?.map((s) => s.staff)
          .filter(Boolean) as { id: string; name: string; requires_approval: boolean }[] | undefined;
        // If staffName is provided, match by name among assigned staff
        if (body.staffName && allAssigned && allAssigned.length > 0) {
          const matched = allAssigned.find((s) => s.name.toLowerCase() === body.staffName!.toLowerCase());
          if (matched) return { id: matched.id, name: matched.name, requiresApproval: matched.requires_approval };
        }
        // Otherwise pick first assigned staff
        if (allAssigned && allAssigned.length > 0) {
          return { id: allAssigned[0]!.id, name: body.staffName || allAssigned[0]!.name, requiresApproval: allAssigned[0]!.requires_approval };
        }
        // Fallback: any staff from the tenant
        const { data } = await supabase.from('staff').select('id, name, requires_approval').eq('tenant_id', tenantId).limit(1);
        const s = (data as { id: string; name: string; requires_approval: boolean }[] | null)?.[0];
        return { id: s?.id ?? null, name: body.staffName || s?.name || null, requiresApproval: s?.requires_approval ?? false };
      })(),

      // 8. Tenant name + payments flag
      supabase.from('tenants').select('name, payments_enabled, stripe_account_id').eq('id', tenantId).single(),
    ]);

    // Unpack service
    if (serviceResult.error || !serviceResult.data) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS_HEADERS });
    }
    const svc = serviceResult.data as {
      name: string; duration_minutes: number; price: number;
      deposit_enabled: boolean; deposit_type: string | null; deposit_amount: number | null; tenant_id: string;
      service_type?: string; pricing_type?: string; capacity?: number;
    };

    // Restaurant booking: derive type + pricing from the service itself.
    const isEvent = svc.service_type === 'event';
    if (svc.service_type === 'event') bookingType = 'event';
    else if (svc.service_type === 'table') bookingType = 'table';
    const isPerPerson = svc.pricing_type === 'per_person';
    const guests = partySize && partySize > 0 ? partySize : 1;
    // Per-guest pricing (events): the per-person price is multiplied by party size.
    const perGuestBase = isPerPerson ? svc.price * guests : svc.price;

    // Unpack customer
    if (!customerResult.id) {
      return NextResponse.json(
        { error: `Failed to create customer: ${customerResult.error ?? 'Unknown'}` },
        { status: 500, headers: CORS_HEADERS },
      );
    }
    const customerId = customerResult.id;

    // Unpack location
    const loc = (locationResult.data as { id: string; address: string; latitude: number | null; longitude: number | null; timezone: string; currency?: string }[] | null)?.[0];
    const locationId = loc?.id ?? null;
    const tz = loc?.timezone || 'America/Los_Angeles';

    // Unpack staff
    const finalStaffId = staffResult.id;
    const staffName = staffResult.name;
    const requiresApproval = staffResult.requiresApproval;

    // Unpack tenant
    const tenantData = tenantResult.data as { name: string; payments_enabled: boolean; stripe_account_id: string | null } | null;
    const businessName = tenantData?.name ?? 'Business';
    const paymentsEnabled = tenantData?.payments_enabled ?? false;

    // 2. Parse start time (timezone already available from location query)
    let start: Date;
    if (timeSlotIso) {
      start = new Date(timeSlotIso);
    } else {
      start = localTimeToUTC(date, timeSlot, tz);
    }

    // Reject bookings less than 15 minutes from now
    const nowPlus15 = Date.now() + 15 * 60000;
    if (start.getTime() < nowPlus15) {
      return NextResponse.json(
        { error: 'Cannot book a time slot less than 15 minutes from now. Please choose a later time.' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const end = new Date(start.getTime() + svc.duration_minutes * 60000);

    // 3. Calculate deposit (skip if payments not enabled for this tenant)
    let depositAmount: number | null = null;
    if (paymentsEnabled && svc.deposit_enabled && svc.deposit_amount) {
      depositAmount =
        svc.deposit_type === 'percentage' ? (perGuestBase * svc.deposit_amount) / 100 : svc.deposit_amount;
    }

    // 7a. Look up extras prices and package price
    let extrasTotal = 0;
    let packagePrice = 0;
    const extrasNames = extras ?? [];

    const [extrasResult, packageResult] = await Promise.all([
      extrasNames.length > 0
        ? supabase.from('service_extras').select('id, name, price').eq('service_id', serviceId)
        : Promise.resolve({ data: [] }),
      packageName
        ? supabase.from('packages').select('id, name, price').eq('tenant_id', tenantId).eq('name', packageName).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (extrasNames.length > 0 && extrasResult.data) {
      const extrasList = extrasResult.data as { id: string; name: string; price: number }[];
      for (const eName of extrasNames) {
        const found = extrasList.find((e) => e.name === eName);
        if (found) extrasTotal += found.price;
      }
    }

    if (packageResult.data) {
      packagePrice = (packageResult.data as { price: number }).price ?? 0;
    }

    // Calculate final total: package price if selected, else per-guest/service base, plus extras
    const basePrice = packagePrice > 0 ? packagePrice : perGuestBase;
    const finalTotal = basePrice + extrasTotal;

    // 6b. Check for conflicting appointments (overlapping time, not cancelled).
    // Skip for restaurant booking types — table requests can legitimately overlap
    // (staff confirm them) and capacity-based events allow many bookings per slot.
    if (bookingType === 'service') {
      let conflictQuery = supabase
        .from('appointments')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'confirmed', 'approved'])
        .lt('start_time', end.toISOString())
        .gt('end_time', start.toISOString())
        .limit(1);
      if (finalStaffId) {
        conflictQuery = conflictQuery.eq('staff_id', finalStaffId);
      } else if (serviceId) {
        conflictQuery = conflictQuery.eq('service_id', serviceId);
      }
      const { data: conflicts } = await conflictQuery;
      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { error: 'This time slot was just booked. Please go back and choose a different time.' },
          { status: 409, headers: CORS_HEADERS },
        );
      }
    }

    // 6c. Event capacity check — seats_left = capacity − SUM(party_size) for this seating.
    if (isEvent && svc.capacity && svc.capacity > 0) {
      const { data: seatRows } = await supabase
        .from('appointments')
        .select('party_size')
        .eq('service_id', serviceId)
        .eq('start_time', start.toISOString())
        .in('status', ['pending', 'confirmed', 'approved']);
      const seatsTaken = ((seatRows ?? []) as { party_size: number | null }[])
        .reduce((sum, r) => sum + (r.party_size ?? 1), 0);
      const seatsLeft = svc.capacity - seatsTaken;
      if (seatsLeft < guests) {
        return NextResponse.json(
          { error: seatsLeft <= 0 ? 'This event is sold out.' : `Only ${seatsLeft} seat(s) left for this event.` },
          { status: 409, headers: CORS_HEADERS },
        );
      }
    }

    // 7. Create appointment. Events instant-confirm with no staff resource.
    const finalStatus = isEvent ? 'confirmed' : (requiresApproval ? 'pending' : 'confirmed');
    const apptStaffId = isEvent ? null : finalStaffId;
    const balanceDue = depositAmount ? finalTotal - depositAmount : finalTotal;
    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .insert({
        customer_id: customerId,
        tenant_id: tenantId,
        service_id: serviceId,
        staff_id: apptStaffId,
        location_id: locationId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: finalStatus,
        booking_type: bookingType,
        party_size: partySize,
        total_price: finalTotal,
        deposit_paid: false,
        deposit_amount_paid: depositAmount,
        balance_due: balanceDue,
        notes: packageName ? `Package: ${packageName}` : null,
      } as never)
      .select()
      .single();

    if (apptErr) {
      return NextResponse.json({ error: apptErr.message }, { status: 500, headers: CORS_HEADERS });
    }

    const apptId = (appointment as { id: string }).id;

    // 7b. Insert appointment extras records
    if (extrasNames.length > 0 && extrasResult.data) {
      const extrasList = extrasResult.data as { id: string; name: string; price: number }[];
      const extrasInserts = extrasNames
        .map((eName) => {
          const found = extrasList.find((e) => e.name === eName);
          return found ? { appointment_id: apptId, extra_id: found.id, quantity: 1, price_at_booking: found.price } : null;
        })
        .filter(Boolean);
      if (extrasInserts.length > 0) {
        await supabase.from('appointment_extras').insert(extrasInserts as never[]);
      }
    }

    // Create PaymentIntent for deposit if payments enabled and deposit required.
    // Skip for requires_approval bookings — deposit is collected AFTER staff approves.
    let paymentUrl: string | null = null;
    let paymentClientSecret: string | null = null;
    const paymentRequired = !!(paymentsEnabled && depositAmount && depositAmount > 0 && !requiresApproval);
    const tenantStripeAccountId = tenantData?.stripe_account_id ?? null;
    if (paymentRequired && tenantStripeAccountId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
        const depositAmountCents = Math.round(depositAmount! * 100);
        const platformFeeCents = Math.round(depositAmountCents * 0.1);

        const paymentIntent = await stripeClient.paymentIntents.create({
          amount: depositAmountCents,
          currency: (loc?.currency ?? 'USD').toLowerCase(),
          automatic_payment_methods: { enabled: true },
          transfer_data: { destination: tenantStripeAccountId },
          application_fee_amount: platformFeeCents,
          metadata: {
            appointment_id: apptId,
            customer_id: customerId ?? '',
            payment_type: 'deposit',
          },
          description: `Deposit for ${svc.name} at ${businessName}`,
        });

        await supabase.from('appointments')
          .update({ stripe_payment_intent_id: paymentIntent.id } as never)
          .eq('id', apptId);

        paymentClientSecret = paymentIntent.client_secret;
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://app.balkina.ai');
        paymentUrl = `${baseUrl}/pay/${apptId}`;
        console.log('[booking/create] PaymentIntent created:', paymentIntent.id, requiresApproval ? '(manual capture)' : '(auto capture)');
      } catch (stripeErr) {
        console.error('[booking/create] Stripe PaymentIntent creation failed:', stripeErr);
      }
    }

    // Fire notifications — await so they complete before Vercel terminates the function
    try {
      if (requiresApproval) {
        // Booking needs staff approval — notify customer it's submitted, notify staff to approve
        await Promise.allSettled([
          notifyBookingSubmitted(apptId),
          notifyStaffNewBooking(apptId),
        ]);
      } else {
        // Auto-confirmed — notify customer it's confirmed, notify staff of new booking
        await Promise.allSettled([
          notifyBookingConfirmed(apptId),
          notifyStaffNewBooking(apptId),
        ]);
      }
    } catch (e) {
      console.error('[booking/create] notification error:', e);
    }

    // 8c. Push to staff's Google Calendar (non-blocking)
    if (!requiresApproval) {
      pushEventToGoogleCalendar(apptId).catch(() => {});
    }

    // 9. Format response with local times (timezone already available)
    const localDate = start.toLocaleDateString('en-US', {
      timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const localTime = start.toLocaleString('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    });

    return NextResponse.json(
      {
        success: true,
        appointment_id: (appointment as { id: string }).id,
        status: requiresApproval ? 'pending' : 'confirmed',
        booking_type: bookingType,
        party_size: partySize,
        service_name: svc.name,
        staff_name: staffName,
        business_name: businessName,
        date: localDate,
        time: localTime,
        address: loc?.address ?? '',
        total: finalTotal,
        currency: (loc?.currency ?? 'USD') as string,
        deposit_amount: depositAmount,
        deposit_paid: false,
        payment_url: paymentUrl,
        payment_client_secret: paymentClientSecret,
        payment_required: paymentRequired,
        latitude: loc?.latitude ?? undefined,
        longitude: loc?.longitude ?? undefined,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error('[booking/create] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
