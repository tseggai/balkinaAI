/**
 * Tool execution handlers for the AI chatbot.
 * Each handler runs a Supabase query and returns a result object
 * that gets sent back to the AI as a tool_result.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient;

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ── Timezone helpers ────────────────────────────────────────────────────────

/**
 * Get the UTC offset in minutes for a given IANA timezone at a reference date.
 * Positive = east of UTC (e.g. Europe/Berlin in summer = +120).
 */
function getTimezoneOffsetMinutes(timezone: string, refDate: Date): number {
  const utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = refDate.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

/**
 * Convert a local date + time in a given timezone to a UTC Date.
 * dateStr: "2024-06-15", timeStr: "09:00", timezone: "America/New_York"
 */
function localTimeToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  // Treat the local time as if it were UTC to get a reference point
  const asUtc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  // Compute the timezone offset at that reference point
  const offsetMs = getTimezoneOffsetMinutes(timezone, asUtc) * 60000;
  // UTC = local_time - offset
  return new Date(asUtc.getTime() - offsetMs);
}

/**
 * Fetch the tenant's timezone from their first location, default to UTC.
 */
async function getTenantTimezone(supabase: AdminClient, tenantId: string): Promise<string> {
  const { data } = await supabase
    .from('tenant_locations')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();
  return (data as { timezone: string } | null)?.timezone || 'UTC';
}

// ── find_businesses ──────────────────────────────────────────────────────────

export async function handleFindBusinesses(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const query = (input.query as string) || '';

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, categories(name)')
    .eq('status', 'active')
    .or(`name.ilike.%${query}%`)
    .limit(10);

  if (error) return { success: false, error: error.message };

  // Also search services for matching service names
  const { data: serviceMatches } = await supabase
    .from('services')
    .select('tenant_id, name, price, duration_minutes, tenants(id, name)')
    .ilike('name', `%${query}%`)
    .limit(10);

  return {
    success: true,
    data: {
      businesses: data ?? [],
      matching_services: serviceMatches ?? [],
    },
  };
}

// ── get_services ────────────────────────────────────────────────────────────

export async function handleGetServices(
  supabase: AdminClient,
  tenantId: string,
  _input: Record<string, unknown>,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price, deposit_enabled, deposit_type, deposit_amount, service_extras(id, name, price, duration_minutes)')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ── get_service_details ─────────────────────────────────────────────────────

export async function handleGetServiceDetails(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const serviceId = input.service_id as string;
  if (!serviceId) return { success: false, error: 'service_id is required' };

  const { data, error } = await supabase
    .from('services')
    .select('*, service_extras(*), categories(name)')
    .eq('id', serviceId)
    .single();

  if (error) return { success: false, error: error.message };

  // Also fetch staff that can perform this service (all staff for this tenant)
  const service = data as { tenant_id: string } | null;
  if (service) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, name')
      .eq('tenant_id', service.tenant_id);
    return { success: true, data: { ...service, available_staff: staffData ?? [] } };
  }

  return { success: true, data };
}

// ── get_staff ───────────────────────────────────────────────────────────────

export async function handleGetStaff(
  supabase: AdminClient,
  tenantId: string,
  _input: Record<string, unknown>,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, availability_schedule')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ── check_availability ──────────────────────────────────────────────────────

export async function handleCheckAvailability(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const serviceId = input.service_id as string;
  const date = input.date as string; // YYYY-MM-DD
  const staffId = input.staff_id as string | undefined;

  if (!serviceId || !date) {
    return { success: false, error: 'service_id and date are required' };
  }

  // 1. Get service duration
  const { data: service, error: svcErr } = await supabase
    .from('services')
    .select('duration_minutes, tenant_id')
    .eq('id', serviceId)
    .single();

  if (svcErr || !service) return { success: false, error: 'Service not found' };
  const svc = service as { duration_minutes: number; tenant_id: string };

  // 2. Get staff for this tenant
  let staffQuery = supabase
    .from('staff')
    .select('id, name, availability_schedule')
    .eq('tenant_id', tenantId);

  if (staffId) {
    staffQuery = staffQuery.eq('id', staffId);
  }

  const { data: staffList } = await staffQuery;
  if (!staffList || staffList.length === 0) {
    return { success: true, data: { available_slots: [], message: 'No staff available' } };
  }

  // 3. Resolve the tenant's timezone so we generate slots in local time
  const timezone = await getTenantTimezone(supabase, tenantId);

  // Query existing appointments for the entire local day (converted to UTC range)
  const dayStartUtc = localTimeToUTC(date, '00:00', timezone).toISOString();
  const dayEndUtc = localTimeToUTC(date, '23:59', timezone).toISOString();

  const { data: existingAppts } = await supabase
    .from('appointments')
    .select('staff_id, start_time, end_time')
    .eq('tenant_id', tenantId)
    .gte('start_time', dayStartUtc)
    .lte('start_time', dayEndUtc)
    .in('status', ['pending', 'confirmed']);

  const appointments = (existingAppts ?? []) as { staff_id: string | null; start_time: string; end_time: string }[];

  // 4. Generate available slots from staff schedules
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[new Date(date).getDay()] as string;

  const slots: { time: string; staff_id: string; staff_name: string }[] = [];

  for (const staff of staffList as { id: string; name: string; availability_schedule: Record<string, unknown> }[]) {
    const schedule = staff.availability_schedule as Record<string, { start: string; end: string } | undefined>;
    const daySchedule = schedule[dayOfWeek];

    if (!daySchedule?.start || !daySchedule?.end) continue;

    // Parse schedule hours (e.g., "09:00" -> 9, "17:00" -> 17)
    const startParts = daySchedule.start.split(':').map(Number);
    const endParts = daySchedule.end.split(':').map(Number);
    const scheduleStartMinutes = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
    const scheduleEndMinutes = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);

    // Generate slots in 30-minute increments — convert local time to UTC
    for (let minutes = scheduleStartMinutes; minutes + svc.duration_minutes <= scheduleEndMinutes; minutes += 30) {
      const slotHour = Math.floor(minutes / 60);
      const slotMin = minutes % 60;
      const localTimeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

      // Convert the local slot time to proper UTC
      const slotStartUtc = localTimeToUTC(date, localTimeStr, timezone);
      const slotEndUtc = new Date(slotStartUtc.getTime() + svc.duration_minutes * 60000);

      // Check for conflicts against existing appointments (all in UTC)
      const hasConflict = appointments.some((appt) => {
        if (appt.staff_id !== staff.id) return false;
        const apptStart = new Date(appt.start_time).getTime();
        const apptEnd = new Date(appt.end_time).getTime();
        return slotStartUtc.getTime() < apptEnd && slotEndUtc.getTime() > apptStart;
      });

      if (!hasConflict) {
        slots.push({
          time: slotStartUtc.toISOString(),
          staff_id: staff.id,
          staff_name: staff.name,
        });
      }
    }
  }

  return {
    success: true,
    data: {
      date,
      service_duration_minutes: svc.duration_minutes,
      available_slots: slots,
    },
  };
}

// ── book_appointment ────────────────────────────────────────────────────────

export async function handleBookAppointment(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
  sessionInfo: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string },
): Promise<ToolResult> {
  const serviceId = input.service_id as string;
  const startTime = input.start_time as string;
  const staffId = (input.staff_id as string) || null;
  const locationId = (input.location_id as string) || null;

  if (!serviceId || !startTime) {
    return { success: false, error: 'service_id and start_time are required' };
  }

  // 1. Get service details
  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (!service) return { success: false, error: 'Service not found' };
  const svc = service as { duration_minutes: number; price: number; deposit_enabled: boolean; deposit_type: string | null; deposit_amount: number | null; tenant_id: string };

  // 2. Calculate end time — handle timezone correctly
  //    If the AI passes a time without Z or offset (local time), convert using tenant timezone.
  //    If it already ends with Z or has an offset, trust it as UTC/absolute.
  let start: Date;
  const hasTimezoneInfo = /Z$|[+-]\d{2}:\d{2}$/.test(startTime);
  if (hasTimezoneInfo) {
    start = new Date(startTime);
  } else {
    // Interpret as local time in the tenant's timezone
    const timezone = await getTenantTimezone(supabase, tenantId);
    const [datePart, timePart] = startTime.split('T');
    if (datePart && timePart) {
      start = localTimeToUTC(datePart, timePart.slice(0, 5), timezone);
    } else {
      start = new Date(startTime);
    }
  }
  const end = new Date(start.getTime() + svc.duration_minutes * 60000);

  // 3. Calculate deposit
  let depositAmount: number | null = null;
  if (svc.deposit_enabled && svc.deposit_amount) {
    depositAmount = svc.deposit_type === 'percentage'
      ? (svc.price * svc.deposit_amount) / 100
      : svc.deposit_amount;
  }

  // 4. Create or find customer record
  let customerId = sessionInfo.customerId;

  if (!customerId && sessionInfo.customerPhone) {
    // Try to find existing customer by phone
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', sessionInfo.customerPhone)
      .limit(1)
      .single();

    if (existingCustomer) {
      customerId = (existingCustomer as { id: string }).id;
    }
  }

  if (!customerId) {
    // Create anonymous customer via auth (service role can create users)
    const email = `chat_${Date.now()}@widget.balkina.ai`;
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: sessionInfo.customerName ?? 'Guest',
        source: 'chat_widget',
      },
    });

    if (authErr || !authUser.user) {
      return { success: false, error: `Failed to create customer: ${authErr?.message ?? 'Unknown error'}` };
    }

    customerId = authUser.user.id;

    // Insert customer record
    await supabase.from('customers').insert({
      id: customerId,
      display_name: sessionInfo.customerName,
      phone: sessionInfo.customerPhone,
      email: null,
    } as never);
  }

  // 5. Get a location if not specified
  let finalLocationId = locationId;
  if (!finalLocationId) {
    const { data: locations } = await supabase
      .from('tenant_locations')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);
    finalLocationId = (locations as { id: string }[] | null)?.[0]?.id ?? null;
  }

  // 6. Get a staff member if not specified
  let finalStaffId = staffId;
  if (!finalStaffId) {
    const { data: staffMembers } = await supabase
      .from('staff')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);
    finalStaffId = (staffMembers as { id: string }[] | null)?.[0]?.id ?? null;
  }

  // 7. Create the appointment
  const balanceDue = depositAmount ? svc.price - depositAmount : svc.price;

  const { data: appointment, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      customer_id: customerId,
      tenant_id: tenantId,
      service_id: serviceId,
      staff_id: finalStaffId,
      location_id: finalLocationId,
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

  if (apptErr) return { success: false, error: apptErr.message };

  // 8. Link customer to chat session
  if (customerId) {
    await supabase
      .from('chat_sessions')
      .update({ customer_id: customerId } as never)
      .eq('id', sessionInfo.chatSessionId);
  }

  return {
    success: true,
    data: {
      appointment_id: (appointment as { id: string }).id,
      service_name: (service as { name: string }).name,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      total_price: svc.price,
      deposit_amount: depositAmount,
      balance_due: balanceDue,
      status: 'confirmed',
    },
  };
}

// ── cancel_appointment ──────────────────────────────────────────────────────

export async function handleCancelAppointment(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const appointmentId = input.appointment_id as string;
  if (!appointmentId) return { success: false, error: 'appointment_id is required' };

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' } as never)
    .eq('id', appointmentId)
    .in('status', ['pending', 'confirmed'])
    .select('id, status')
    .single();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: 'Appointment not found or already cancelled/completed' };
  return { success: true, data };
}

// ── get_booking_details ─────────────────────────────────────────────────────

export async function handleGetBookingDetails(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const appointmentId = input.appointment_id as string;
  if (!appointmentId) return { success: false, error: 'appointment_id is required' };

  const { data, error } = await supabase
    .from('appointments')
    .select('*, services(name, duration_minutes, price), staff(name), tenant_locations(name, address)')
    .eq('id', appointmentId)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ── Tool dispatcher ─────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: AdminClient,
  tenantId: string,
  sessionInfo: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string },
): Promise<ToolResult> {
  switch (toolName) {
    case 'find_businesses':
      return handleFindBusinesses(supabase, tenantId, toolInput);
    case 'search_services':
    case 'get_services':
      return handleGetServices(supabase, tenantId, toolInput);
    case 'get_service_details':
      return handleGetServiceDetails(supabase, tenantId, toolInput);
    case 'search_tenants':
    case 'get_staff':
      return handleGetStaff(supabase, tenantId, toolInput);
    case 'check_availability':
      return handleCheckAvailability(supabase, tenantId, toolInput);
    case 'create_booking':
      return handleBookAppointment(supabase, tenantId, toolInput, sessionInfo);
    case 'cancel_appointment':
      return handleCancelAppointment(supabase, tenantId, toolInput);
    case 'get_customer_appointments':
    case 'get_booking_details':
      return handleGetBookingDetails(supabase, tenantId, toolInput);
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
