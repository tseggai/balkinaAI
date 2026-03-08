import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

interface DaySchedule {
  enabled?: boolean;
  start: string;
  end: string;
  breaks?: { start: string; end: string }[];
}

export async function GET(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get('service_id');
  const date = searchParams.get('date'); // YYYY-MM-DD
  const staffId = searchParams.get('staff_id');

  if (!serviceId || !date) {
    return NextResponse.json({ data: null, error: { message: 'service_id and date are required' } }, { status: 400 });
  }

  const supabase = createClient();

  // 1. Get service details
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, buffer_time_before, buffer_time_after')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .single();

  if (!service) {
    return NextResponse.json({ data: null, error: { message: 'Service not found' } }, { status: 404 });
  }
  const svc = service as { duration_minutes: number; buffer_time_before: number | null; buffer_time_after: number | null };
  const duration = svc.duration_minutes;
  const bufferBefore = svc.buffer_time_before ?? 0;
  const bufferAfter = svc.buffer_time_after ?? 0;

  // 2. Get staff — if staffId specified filter to that, otherwise get all staff for service
  let staffQuery = supabase
    .from('staff')
    .select('id, name, availability_schedule')
    .eq('tenant_id', tenantId);

  if (staffId) {
    staffQuery = staffQuery.eq('id', staffId);
  }

  const { data: staffList } = await staffQuery;
  if (!staffList || staffList.length === 0) {
    return NextResponse.json({ data: [], error: null });
  }

  // 3. Get staff who can perform this service (via service_staff junction)
  const { data: serviceStaffLinks } = await supabase
    .from('service_staff')
    .select('staff_id')
    .eq('service_id', serviceId);

  const serviceStaffIds = new Set((serviceStaffLinks ?? []).map((ss: { staff_id: string }) => ss.staff_id));

  // Filter staff to those who can perform this service (if service_staff links exist)
  const eligibleStaff = serviceStaffIds.size > 0
    ? (staffList as { id: string; name: string; availability_schedule: Record<string, unknown> }[]).filter(s => serviceStaffIds.has(s.id))
    : staffList as { id: string; name: string; availability_schedule: Record<string, unknown> }[];

  if (eligibleStaff.length === 0) {
    return NextResponse.json({ data: [], error: null });
  }

  // 4. Check staff holidays
  const eligibleStaffIds = eligibleStaff.map(s => s.id);
  const { data: holidays } = await supabase
    .from('staff_holidays')
    .select('staff_id')
    .in('staff_id', eligibleStaffIds)
    .eq('date', date);

  const holidayStaffIds = new Set((holidays ?? []).map((h: { staff_id: string }) => h.staff_id));

  // 5. Get existing appointments for the date
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const { data: existingAppts } = await supabase
    .from('appointments')
    .select('staff_id, start_time, end_time')
    .eq('tenant_id', tenantId)
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)
    .in('status', ['pending', 'confirmed']);

  const appointments = (existingAppts ?? []) as { staff_id: string | null; start_time: string; end_time: string }[];

  // 6. Generate available slots
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[new Date(date + 'T12:00:00').getDay()] as string;

  const slotSet = new Map<string, { time: string; staff: { id: string; name: string }[] }>();

  for (const staff of eligibleStaff) {
    if (holidayStaffIds.has(staff.id)) continue;

    const schedule = staff.availability_schedule as Record<string, DaySchedule | undefined>;
    const daySchedule = schedule[dayOfWeek];

    if (!daySchedule) continue;
    if (daySchedule.enabled === false) continue;
    if (!daySchedule.start || !daySchedule.end) continue;

    const startParts = daySchedule.start.split(':').map(Number);
    const endParts = daySchedule.end.split(':').map(Number);
    const scheduleStartMinutes = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
    const scheduleEndMinutes = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);
    const breaks = daySchedule.breaks ?? [];

    // Generate slots in 15-minute increments
    for (let minutes = scheduleStartMinutes; minutes + duration <= scheduleEndMinutes; minutes += 15) {
      const slotStartMinutes = minutes;
      const slotEndMinutes = minutes + duration;

      // Check if slot overlaps with any break
      const overlapsBreak = breaks.some((brk) => {
        const brkStartParts = brk.start.split(':').map(Number);
        const brkEndParts = brk.end.split(':').map(Number);
        const brkStart = (brkStartParts[0] ?? 0) * 60 + (brkStartParts[1] ?? 0);
        const brkEnd = (brkEndParts[0] ?? 0) * 60 + (brkEndParts[1] ?? 0);
        return slotStartMinutes < brkEnd && slotEndMinutes > brkStart;
      });
      if (overlapsBreak) continue;

      // Build the ISO time string for this slot
      const slotHour = Math.floor(minutes / 60);
      const slotMin = minutes % 60;
      const timeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
      const slotStartISO = `${date}T${timeStr}:00.000Z`;
      const slotStartMs = new Date(slotStartISO).getTime();
      const slotEndMs = slotStartMs + duration * 60000;

      // Account for buffer times when checking conflicts
      const bufferedStartMs = slotStartMs - bufferBefore * 60000;
      const bufferedEndMs = slotEndMs + bufferAfter * 60000;

      // Check conflicts with existing appointments for this staff
      const hasConflict = appointments.some((appt) => {
        if (appt.staff_id !== staff.id) return false;
        const apptStart = new Date(appt.start_time).getTime();
        const apptEnd = new Date(appt.end_time).getTime();
        return bufferedStartMs < apptEnd && bufferedEndMs > apptStart;
      });

      if (!hasConflict) {
        const existing = slotSet.get(timeStr);
        if (existing) {
          existing.staff.push({ id: staff.id, name: staff.name });
        } else {
          slotSet.set(timeStr, {
            time: timeStr,
            staff: [{ id: staff.id, name: staff.name }],
          });
        }
      }
    }
  }

  // Sort slots by time
  const slots = Array.from(slotSet.values()).sort((a, b) => a.time.localeCompare(b.time));

  return NextResponse.json({ data: slots, error: null });
}
