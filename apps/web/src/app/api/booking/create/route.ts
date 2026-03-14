/**
 * POST /api/booking/create
 * Direct REST endpoint for client-side booking (Phase 2).
 * Creates an appointment without going through GPT.
 *
 * Body: { tenantId, serviceId, staffId?, date, timeSlot, timeSlotIso?, extras?, packageName?, userId?, customerName?, customerPhone?, customerEmail? }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyBookingConfirmed, notifyStaffNewBooking } from '@/lib/notifications/booking-events';

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
    const { tenantId, serviceId, staffId, date, timeSlot, timeSlotIso, extras, packageName, userId, customerName, customerPhone, customerEmail } = body;

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
        if (userId) {
          // Try user_id first, then try id = userId (for customers where id matches auth user id)
          const { data } = await supabase.from('customers').select('id').eq('user_id', userId).limit(1).maybeSingle();
          if (data) return { id: (data as { id: string }).id, error: null };
          const { data: byId } = await supabase.from('customers').select('id').eq('id', userId).limit(1).maybeSingle();
          if (byId) return { id: (byId as { id: string }).id, error: null };
        }
        if (customerEmail) {
          const { data } = await supabase.from('customers').select('id').eq('email', customerEmail).limit(1).maybeSingle();
          if (data) {
            // Link user_id if not already set
            if (userId) {
              await supabase.from('customers').update({ user_id: userId } as never).eq('id', (data as { id: string }).id).is('user_id', null);
            }
            return { id: (data as { id: string }).id, error: null };
          }
        }
        if (customerPhone) {
          const { data } = await supabase.from('customers').select('id').eq('phone', customerPhone).limit(1).maybeSingle();
          if (data) {
            // Link user_id if not already set
            if (userId) {
              await supabase.from('customers').update({ user_id: userId } as never).eq('id', (data as { id: string }).id).is('user_id', null);
            }
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
      supabase.from('tenant_locations').select('id, address, latitude, longitude, timezone')
        .eq('tenant_id', tenantId).limit(1),

      // 6. Staff — prefer service_staff assignment over random tenant staff
      (async () => {
        if (staffId) {
          const { data } = await supabase.from('staff').select('id, name').eq('id', staffId).single();
          const s = data as { id: string; name: string } | null;
          return { id: s?.id ?? staffId, name: body.staffName || s?.name || null };
        }
        // Pick first staff assigned to this service via service_staff junction
        const { data: serviceStaff } = await supabase
          .from('service_staff')
          .select('staff:staff_id(id, name)')
          .eq('service_id', serviceId)
          .limit(1);
        const assigned = (serviceStaff as unknown as { staff: { id: string; name: string } | null }[] | null)?.[0]?.staff;
        if (assigned) return { id: assigned.id, name: body.staffName || assigned.name };
        // Fallback: any staff from the tenant
        const { data } = await supabase.from('staff').select('id, name').eq('tenant_id', tenantId).limit(1);
        const s = (data as { id: string; name: string }[] | null)?.[0];
        return { id: s?.id ?? null, name: body.staffName || s?.name || null };
      })(),

      // 8. Tenant name
      supabase.from('tenants').select('name').eq('id', tenantId).single(),
    ]);

    // Unpack service
    if (serviceResult.error || !serviceResult.data) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS_HEADERS });
    }
    const svc = serviceResult.data as {
      name: string; duration_minutes: number; price: number;
      deposit_enabled: boolean; deposit_type: string | null; deposit_amount: number | null; tenant_id: string;
    };

    // Unpack customer
    if (!customerResult.id) {
      return NextResponse.json(
        { error: `Failed to create customer: ${customerResult.error ?? 'Unknown'}` },
        { status: 500, headers: CORS_HEADERS },
      );
    }
    const customerId = customerResult.id;

    // Unpack location
    const loc = (locationResult.data as { id: string; address: string; latitude: number | null; longitude: number | null; timezone: string }[] | null)?.[0];
    const locationId = loc?.id ?? null;
    const tz = loc?.timezone || 'America/Los_Angeles';

    // Unpack staff
    const finalStaffId = staffResult.id;
    const staffName = staffResult.name;

    // Unpack tenant
    const businessName = (tenantResult.data as { name: string } | null)?.name ?? 'Business';

    // 2. Parse start time (timezone already available from location query)
    let start: Date;
    if (timeSlotIso) {
      start = new Date(timeSlotIso);
    } else {
      start = localTimeToUTC(date, timeSlot, tz);
    }
    const end = new Date(start.getTime() + svc.duration_minutes * 60000);

    // 3. Calculate deposit
    let depositAmount: number | null = null;
    if (svc.deposit_enabled && svc.deposit_amount) {
      depositAmount =
        svc.deposit_type === 'percentage' ? (svc.price * svc.deposit_amount) / 100 : svc.deposit_amount;
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

    // Calculate final total: use package price if selected, otherwise service price, plus extras
    const basePrice = packagePrice > 0 ? packagePrice : svc.price;
    const finalTotal = basePrice + extrasTotal;

    // 7. Create appointment
    const balanceDue = depositAmount ? finalTotal - depositAmount : finalTotal;
    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .insert({
        customer_id: customerId,
        tenant_id: tenantId,
        service_id: serviceId,
        staff_id: finalStaffId,
        location_id: locationId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'confirmed',
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

    // Fire notifications (non-blocking)
    void Promise.allSettled([
      notifyBookingConfirmed(apptId),
      notifyStaffNewBooking(apptId),
    ]);

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
        service_name: svc.name,
        staff_name: staffName,
        business_name: businessName,
        date: localDate,
        time: localTime,
        address: loc?.address ?? '',
        total: finalTotal,
        deposit_amount: depositAmount,
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
