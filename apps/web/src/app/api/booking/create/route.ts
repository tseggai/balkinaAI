/**
 * POST /api/booking/create
 * Direct REST endpoint for client-side booking (Phase 2).
 * Creates an appointment without going through GPT.
 *
 * Body: { tenantId, serviceId, staffId?, date, timeSlot, timeSlotIso?, extras?, packageName?, userId?, customerName?, customerPhone?, customerEmail? }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

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
    const { tenantId, serviceId, staffId, date, timeSlot, timeSlotIso, userId, customerName, customerPhone, customerEmail } = body;

    if (!tenantId || !serviceId || !date || !timeSlot) {
      return NextResponse.json(
        { error: 'tenantId, serviceId, date, and timeSlot are required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const supabase = createAdminClient();

    // 1. Get service details
    const { data: service, error: svcErr } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (svcErr || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const svc = service as {
      name: string;
      duration_minutes: number;
      price: number;
      deposit_enabled: boolean;
      deposit_type: string | null;
      deposit_amount: number | null;
      tenant_id: string;
    };

    // 2. Parse start time
    let start: Date;
    if (timeSlotIso) {
      start = new Date(timeSlotIso);
    } else {
      // Get tenant timezone
      const { data: locData } = await supabase
        .from('tenant_locations')
        .select('timezone')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();
      const timezone = (locData as { timezone: string } | null)?.timezone || 'America/Los_Angeles';
      start = localTimeToUTC(date, timeSlot, timezone);
    }
    const end = new Date(start.getTime() + svc.duration_minutes * 60000);

    // 3. Calculate deposit
    let depositAmount: number | null = null;
    if (svc.deposit_enabled && svc.deposit_amount) {
      depositAmount =
        svc.deposit_type === 'percentage' ? (svc.price * svc.deposit_amount) / 100 : svc.deposit_amount;
    }

    // 4. Find or create customer
    let customerId: string | null = null;

    if (userId) {
      const { data: byUserId } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (byUserId) customerId = (byUserId as { id: string }).id;
    }

    if (!customerId && customerPhone) {
      const { data: byPhone } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', customerPhone)
        .limit(1)
        .maybeSingle();
      if (byPhone) customerId = (byPhone as { id: string }).id;
    }

    if (!customerId) {
      const email = `chat_${Date.now()}@widget.balkina.ai`;
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: customerName ?? 'Guest', source: 'chat_widget' },
      });
      if (authErr || !authUser.user) {
        return NextResponse.json(
          { error: `Failed to create customer: ${authErr?.message ?? 'Unknown'}` },
          { status: 500, headers: CORS_HEADERS },
        );
      }
      customerId = authUser.user.id;
      await supabase.from('customers').insert({
        id: customerId,
        display_name: customerName,
        phone: customerPhone,
        email: customerEmail ?? null,
        user_id: userId ?? null,
      } as never);
    }

    // 5. Get location
    let locationId: string | null = null;
    const { data: locations } = await supabase
      .from('tenant_locations')
      .select('id, address, latitude, longitude')
      .eq('tenant_id', tenantId)
      .limit(1);
    const loc = (locations as { id: string; address: string; latitude: number | null; longitude: number | null }[] | null)?.[0];
    locationId = loc?.id ?? null;

    // 6. Get staff if not specified
    let finalStaffId = staffId || null;
    let staffName = body.staffName || null;
    if (!finalStaffId) {
      const { data: staffMembers } = await supabase
        .from('staff')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .limit(1);
      const s = (staffMembers as { id: string; name: string }[] | null)?.[0];
      finalStaffId = s?.id ?? null;
      if (!staffName && s) staffName = s.name;
    }
    if (finalStaffId && !staffName) {
      const { data: staffData } = await supabase.from('staff').select('name').eq('id', finalStaffId).single();
      staffName = (staffData as { name: string } | null)?.name ?? null;
    }

    // 7. Create appointment
    const balanceDue = depositAmount ? svc.price - depositAmount : svc.price;
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
        total_price: svc.price,
        deposit_paid: false,
        deposit_amount_paid: depositAmount,
        balance_due: balanceDue,
      } as never)
      .select()
      .single();

    if (apptErr) {
      return NextResponse.json({ error: apptErr.message }, { status: 500, headers: CORS_HEADERS });
    }

    // 8. Get tenant name
    const { data: tenantData } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
    const businessName = (tenantData as { name: string } | null)?.name ?? 'Business';

    // 9. Format response with local times
    const { data: tzData } = await supabase
      .from('tenant_locations')
      .select('timezone')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();
    const tz = (tzData as { timezone: string } | null)?.timezone || 'America/Los_Angeles';

    const localDate = start.toLocaleDateString('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const localTime = start.toLocaleString('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
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
        total: svc.price,
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
