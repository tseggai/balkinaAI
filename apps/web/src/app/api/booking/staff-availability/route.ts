/**
 * POST /api/booking/staff-availability
 * Direct REST endpoint for client-side booking flow (Phase 2).
 * Returns staff list with available time slots — no GPT involvement.
 *
 * Body: { tenantId, serviceId, date, staffId?, customerId?, userId? }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Timezone helpers (shared with tool-handlers) ────────────────────────────

function getTimezoneOffsetMinutes(timezone: string, refDate: Date): number {
  const utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = refDate.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

function localTimeToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  const asUtc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const offsetMs = getTimezoneOffsetMinutes(timezone, asUtc) * 60000;
  return new Date(asUtc.getTime() - offsetMs);
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tenantId: string;
      serviceId: string;
      date: string;
      staffId?: string;
      customerId?: string;
      userId?: string;
    };

    const { tenantId, serviceId, date, staffId, customerId, userId } = body;

    if (!tenantId || !serviceId || !date) {
      return NextResponse.json({ error: 'tenantId, serviceId, and date are required' }, { status: 400, headers: CORS_HEADERS });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400, headers: CORS_HEADERS });
    }

    const supabase = createAdminClient();

    // 1. Get service details including buffer times
    const { data: service, error: svcErr } = await supabase
      .from('services')
      .select('duration_minutes, tenant_id, buffer_time_before, buffer_time_after')
      .eq('id', serviceId)
      .single();

    if (svcErr || !service) {
      console.error('[booking/staff-availability] Service not found:', serviceId, svcErr?.message);
      return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const svc = service as { duration_minutes: number; tenant_id: string; buffer_time_before: number | null; buffer_time_after: number | null };
    const bufferBefore = svc.buffer_time_before ?? 0;
    const bufferAfter = svc.buffer_time_after ?? 0;
    const totalSlotMinutes = bufferBefore + svc.duration_minutes + bufferAfter;

    // 2-7: Run independent queries in parallel
    const [
      specialDaysResult,
      serviceStaffResult,
      timezoneResult,
    ] = await Promise.all([
      // 2. Service special days
      supabase
        .from('service_special_days')
        .select('is_day_off, start_time, end_time, breaks')
        .eq('service_id', serviceId)
        .eq('date', date),
      // 3. Staff assigned to this service
      supabase
        .from('service_staff')
        .select('staff_id, staff:staff_id(id, name, image_url, availability_schedule)')
        .eq('service_id', serviceId),
      // 5. Tenant timezone + address
      supabase
        .from('tenant_locations')
        .select('timezone, address')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single(),
    ]);

    const serviceSpecialDay = (specialDaysResult.data ?? [])[0] as { is_day_off: boolean; start_time: string | null; end_time: string | null; breaks: unknown } | undefined;

    if (serviceSpecialDay?.is_day_off) {
      return NextResponse.json({
        staff: [],
        slots: [],
        date,
        service_duration_minutes: svc.duration_minutes,
        message: 'This service is not available on this date.',
      }, { headers: CORS_HEADERS });
    }

    let eligibleStaff = ((serviceStaffResult.data ?? []) as unknown as { staff_id: string; staff: { id: string; name: string; image_url: string | null; availability_schedule: Record<string, unknown> } | null }[])
      .map((ss) => ss.staff)
      .filter(Boolean) as { id: string; name: string; image_url: string | null; availability_schedule: Record<string, unknown> }[];

    if (eligibleStaff.length === 0) {
      return NextResponse.json({
        staff: [],
        slots: [],
        date,
        service_duration_minutes: svc.duration_minutes,
        message: 'No staff assigned to this service.',
      }, { headers: CORS_HEADERS });
    }

    if (staffId) {
      eligibleStaff = eligibleStaff.filter((s) => s.id === staffId);
    }

    if (eligibleStaff.length === 0) {
      return NextResponse.json({
        staff: [],
        slots: [],
        date,
        message: 'Requested staff is not assigned to this service.',
      }, { headers: CORS_HEADERS });
    }

    const locationData = timezoneResult.data as { timezone: string; address: string | null } | null;
    const timezone = locationData?.timezone || 'UTC';
    const address = locationData?.address || null;
    const staffIds = eligibleStaff.map((s) => s.id);

    // 4. Staff special days, holidays, and existing appointments — in parallel
    const dayStartUtc = localTimeToUTC(date, '00:00', timezone).toISOString();
    const dayEndUtc = localTimeToUTC(date, '23:59', timezone).toISOString();

    const [staffSpecialResult, holidayResult, existingApptsResult, customerApptResult] = await Promise.all([
      supabase
        .from('staff_special_days')
        .select('staff_id, is_day_off, start_time, end_time, breaks')
        .in('staff_id', staffIds)
        .eq('date', date),
      // staff_holidays table has a single `date` column (not start_date/end_date)
      supabase
        .from('staff_holidays')
        .select('staff_id')
        .in('staff_id', staffIds)
        .eq('date', date),
      supabase
        .from('appointments')
        .select('staff_id, start_time, end_time')
        .eq('tenant_id', tenantId)
        .gte('start_time', dayStartUtc)
        .lte('start_time', dayEndUtc)
        .in('status', ['pending', 'confirmed']),
      // Customer's existing appointments for conflict awareness
      (async () => {
        let resolvedId = customerId ?? null;
        if (!resolvedId && userId) {
          const { data: byUserId } = await supabase
            .from('customers')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();
          if (byUserId) resolvedId = (byUserId as { id: string }).id;
        }
        if (!resolvedId) return [];
        const { data: custAppts } = await supabase
          .from('appointments')
          .select('id, start_time, end_time, services(name), tenants(name)')
          .eq('customer_id', resolvedId)
          .gte('start_time', dayStartUtc)
          .lte('start_time', dayEndUtc)
          .in('status', ['pending', 'confirmed']);
        return ((custAppts ?? []) as unknown as { id: string; start_time: string; end_time: string; services: { name: string } | null; tenants: { name: string } | null }[]).map((a) => ({
          id: a.id,
          start_time: a.start_time,
          end_time: a.end_time,
          service_name: a.services?.name ?? 'Unknown',
          business_name: a.tenants?.name ?? 'Unknown',
        }));
      })(),
    ]);

    const staffSpecialMap = new Map<string, { is_day_off: boolean; start_time: string | null; end_time: string | null; breaks: unknown }>();
    for (const ssd of (staffSpecialResult.data ?? []) as { staff_id: string; is_day_off: boolean; start_time: string | null; end_time: string | null; breaks: unknown }[]) {
      staffSpecialMap.set(ssd.staff_id, ssd);
    }

    const holidayStaffIds = new Set(((holidayResult.data ?? []) as { staff_id: string }[]).map((h) => h.staff_id));
    const appointments = (existingApptsResult.data ?? []) as { staff_id: string | null; start_time: string; end_time: string }[];

    // 7. Generate available slots
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[new Date(date).getDay()] as string;

    // Pre-compute each staff's effective schedule for the day
    interface StaffDayInfo {
      staff: typeof eligibleStaff[number];
      worksToday: boolean;
      startMinutes: number;
      endMinutes: number;
    }

    const staffDayInfos: StaffDayInfo[] = [];
    let masterStartMinutes = Infinity;
    let masterEndMinutes = -Infinity;

    for (const staff of eligibleStaff) {
      if (holidayStaffIds.has(staff.id)) {
        staffDayInfos.push({ staff, worksToday: false, startMinutes: 0, endMinutes: 0 });
        continue;
      }

      const staffSpecial = staffSpecialMap.get(staff.id);
      if (staffSpecial?.is_day_off) {
        staffDayInfos.push({ staff, worksToday: false, startMinutes: 0, endMinutes: 0 });
        continue;
      }

      const schedule = staff.availability_schedule as Record<string, { start: string; end: string } | undefined>;
      let dayScheduleStart: string;
      let dayScheduleEnd: string;

      if (staffSpecial?.start_time && staffSpecial?.end_time) {
        dayScheduleStart = staffSpecial.start_time;
        dayScheduleEnd = staffSpecial.end_time;
      } else {
        const daySchedule = schedule[dayOfWeek];
        if (!daySchedule?.start || !daySchedule?.end) {
          staffDayInfos.push({ staff, worksToday: false, startMinutes: 0, endMinutes: 0 });
          continue;
        }
        dayScheduleStart = daySchedule.start;
        dayScheduleEnd = daySchedule.end;
      }

      if (serviceSpecialDay?.start_time && serviceSpecialDay?.end_time) {
        if (serviceSpecialDay.start_time > dayScheduleStart) dayScheduleStart = serviceSpecialDay.start_time;
        if (serviceSpecialDay.end_time < dayScheduleEnd) dayScheduleEnd = serviceSpecialDay.end_time;
      }

      const startParts = dayScheduleStart.split(':').map(Number);
      const endParts = dayScheduleEnd.split(':').map(Number);
      const startMin = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
      const endMin = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);

      staffDayInfos.push({ staff, worksToday: true, startMinutes: startMin, endMinutes: endMin });

      if (startMin < masterStartMinutes) masterStartMinutes = startMin;
      if (endMin > masterEndMinutes) masterEndMinutes = endMin;
    }

    // If no staff works today, return all staff with 0 slots
    if (masterStartMinutes === Infinity) {
      return NextResponse.json({
        date,
        service_duration_minutes: svc.duration_minutes,
        staff: eligibleStaff.map((s) => ({
          id: s.id,
          name: s.name,
          image_url: s.image_url,
          available_slots_count: 0,
          slots: [],
          all_slots: [],
        })),
        anyone_slots: [],
        address,
        customer_appointments: customerApptResult.length > 0 ? customerApptResult : undefined,
      }, { headers: CORS_HEADERS });
    }

    // Build per-staff slots across the master time range
    const staffWithSlots: {
      id: string;
      name: string;
      image_url: string | null;
      available_slots_count: number;
      slots: { time: string; iso: string }[];
      all_slots: { time: string; iso: string; available: boolean }[];
    }[] = [];

    // anyone_slots: each time slot is available if ANY staff can take it
    const anyoneSlotsMap = new Map<string, { time: string; iso: string; available: boolean }>();

    for (const { staff, worksToday, startMinutes: staffStart, endMinutes: staffEnd } of staffDayInfos) {
      const staffSlots: { time: string; iso: string }[] = [];
      const allSlots: { time: string; iso: string; available: boolean }[] = [];

      for (let minutes = masterStartMinutes; minutes + totalSlotMinutes <= masterEndMinutes; minutes += 30) {
        const slotHour = Math.floor(minutes / 60);
        const slotMin = minutes % 60;
        const localTimeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

        const bufferStartUtc = localTimeToUTC(date, localTimeStr, timezone);
        const slotStartUtc = new Date(bufferStartUtc.getTime() + bufferBefore * 60000);
        const slotEndUtc = new Date(slotStartUtc.getTime() + svc.duration_minutes * 60000);
        const bufferEndUtc = new Date(slotEndUtc.getTime() + bufferAfter * 60000);

        // Staff is available only if they work today AND slot is within their schedule AND no booking conflict
        const inSchedule = worksToday && minutes >= staffStart && minutes + totalSlotMinutes <= staffEnd;

        const hasConflict = inSchedule && appointments.some((appt) => {
          if (appt.staff_id !== staff.id) return false;
          const apptStart = new Date(appt.start_time).getTime();
          const apptEnd = new Date(appt.end_time).getTime();
          return bufferStartUtc.getTime() < apptEnd && bufferEndUtc.getTime() > apptStart;
        });

        const available = inSchedule && !hasConflict;

        const serviceStartMinutes = minutes + bufferBefore;
        const displayHour = Math.floor(serviceStartMinutes / 60);
        const displayMin = serviceStartMinutes % 60;
        const ampm = displayHour >= 12 ? 'PM' : 'AM';
        const displayHour12 = displayHour === 0 ? 12 : displayHour > 12 ? displayHour - 12 : displayHour;
        const localDisplay = `${displayHour12}:${String(displayMin).padStart(2, '0')} ${ampm}`;

        allSlots.push({ time: localDisplay, iso: slotStartUtc.toISOString(), available });

        if (available) {
          staffSlots.push({ time: localDisplay, iso: slotStartUtc.toISOString() });
        }

        // Update anyone map — available if ANY staff can take this slot
        const existing = anyoneSlotsMap.get(localDisplay);
        if (!existing) {
          anyoneSlotsMap.set(localDisplay, { time: localDisplay, iso: slotStartUtc.toISOString(), available });
        } else if (available && !existing.available) {
          anyoneSlotsMap.set(localDisplay, { time: localDisplay, iso: slotStartUtc.toISOString(), available: true });
        }
      }

      staffWithSlots.push({
        id: staff.id,
        name: staff.name,
        image_url: staff.image_url,
        available_slots_count: staffSlots.length,
        slots: staffSlots,
        all_slots: allSlots,
      });
    }

    const anyoneSlots = Array.from(anyoneSlotsMap.values());

    return NextResponse.json({
      date,
      service_duration_minutes: svc.duration_minutes,
      staff: staffWithSlots,
      anyone_slots: anyoneSlots,
      address,
      customer_appointments: customerApptResult.length > 0 ? customerApptResult : undefined,
    }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[booking/staff-availability] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
