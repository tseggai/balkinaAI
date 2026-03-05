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

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function handleFindBusinesses(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const query = ((input.query as string) || '').trim();
  const userLat = input.latitude as number | undefined;
  const userLng = input.longitude as number | undefined;
  const radiusKm = (input.radius_km as number) || 50;

  if (!query) {
    // Return all active businesses when no query is provided
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('status', 'active')
      .limit(10);

    if (error) return { success: false, error: error.message };

    let businesses = data ?? [];
    let locationNote: string | undefined;

    // If user location available, sort by proximity
    if (userLat && userLng && businesses.length > 0) {
      const tenantIds = businesses.map((b) => b.id);
      const { data: locations } = await supabase
        .from('tenant_locations')
        .select('tenant_id, lat, lng')
        .in('tenant_id', tenantIds);

      if (locations && locations.length > 0) {
        const locMap = new Map<string, { lat: number; lng: number }>();
        for (const loc of locations as { tenant_id: string; lat: number | null; lng: number | null }[]) {
          if (loc.lat && loc.lng && !locMap.has(loc.tenant_id)) {
            locMap.set(loc.tenant_id, { lat: loc.lat, lng: loc.lng });
          }
        }
        businesses = businesses
          .map((b) => {
            const loc = locMap.get(b.id);
            const distance = loc ? haversineKm(userLat, userLng, loc.lat, loc.lng) : 9999;
            return { ...b, distance_km: Math.round(distance * 10) / 10 };
          })
          .filter((b) => b.distance_km <= radiusKm)
          .sort((a, b) => a.distance_km - b.distance_km);
      }
    } else {
      locationNote = 'Showing all locations — enable location access for nearby results';
    }

    return { success: true, data: { businesses, matching_services: [], location_note: locationNote } };
  }

  // Sanitize query for use in Supabase filter (escape % and _ which are SQL wildcards)
  const sanitize = (s: string) => s.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const sanitized = sanitize(query);

  // 1. Search tenants by name
  const { data: tenantsByName } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('status', 'active')
    .ilike('name', `%${sanitized}%`)
    .limit(10);

  // 2. Build flexible service search patterns
  //    - Full query: "haircut" → %haircut%
  //    - Individual words (multi-word queries): "hair salon" → %hair%, %salon%
  //    - Compound word splits: "haircut" → %hair%cut%, %hai%rcut% (catches "Hair Cut")
  const servicePatterns: string[] = [`name.ilike.%${sanitized}%`];

  const words = query.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length > 1) {
    for (const w of words) {
      servicePatterns.push(`name.ilike.%${sanitize(w)}%`);
    }
  }

  // For single compound words (e.g. "haircut"), try splitting at each position
  // so "haircut" generates patterns like %hair%cut% which matches "Hair Cut"
  if (!query.includes(' ') && query.length > 4) {
    for (let i = 3; i <= query.length - 2; i++) {
      const left = sanitize(query.slice(0, i));
      const right = sanitize(query.slice(i));
      servicePatterns.push(`name.ilike.%${left}%${right}%`);
    }
  }

  const uniquePatterns = [...new Set(servicePatterns)];

  const { data: serviceMatches } = await supabase
    .from('services')
    .select('tenant_id, name, price, duration_minutes, tenants!inner(id, name)')
    .or(uniquePatterns.join(','))
    .eq('tenants.status', 'active')
    .limit(20);

  // 3. Search tenants by category (e.g. "beauty" matches "Beauty & Personal Care")
  const { data: tenantsByCategory } = await supabase
    .from('tenants')
    .select('id, name, categories!inner(name)')
    .eq('status', 'active')
    .ilike('categories.name', `%${sanitized}%`)
    .limit(10);

  // Merge all found tenants (deduplicate by id)
  const tenantMap = new Map<string, { id: string; name: string }>();
  for (const t of tenantsByName ?? []) {
    tenantMap.set(t.id, t);
  }
  for (const s of (serviceMatches ?? []) as unknown as { tenants: { id: string; name: string } }[]) {
    if (s.tenants) tenantMap.set(s.tenants.id, { id: s.tenants.id, name: s.tenants.name });
  }
  for (const t of (tenantsByCategory ?? []) as unknown as { id: string; name: string }[]) {
    tenantMap.set(t.id, { id: t.id, name: t.name });
  }

  let businesses: { id: string; name: string; distance_km?: number }[] = Array.from(tenantMap.values());
  let locationNote: string | undefined;

  // Sort by proximity if user location is available
  if (userLat && userLng && businesses.length > 0) {
    const tenantIds = businesses.map((b) => b.id);
    const { data: locations } = await supabase
      .from('tenant_locations')
      .select('tenant_id, lat, lng')
      .in('tenant_id', tenantIds);

    if (locations && locations.length > 0) {
      const locMap = new Map<string, { lat: number; lng: number }>();
      for (const loc of locations as { tenant_id: string; lat: number | null; lng: number | null }[]) {
        if (loc.lat && loc.lng && !locMap.has(loc.tenant_id)) {
          locMap.set(loc.tenant_id, { lat: loc.lat, lng: loc.lng });
        }
      }
      businesses = businesses
        .map((b) => {
          const loc = locMap.get(b.id);
          const distance = loc ? haversineKm(userLat, userLng, loc.lat, loc.lng) : 9999;
          return { ...b, distance_km: Math.round(distance * 10) / 10 };
        })
        .filter((b) => (b.distance_km ?? 9999) <= radiusKm)
        .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
    }
  } else {
    locationNote = 'Showing all locations — enable location access for nearby results';
  }

  return {
    success: true,
    data: {
      businesses,
      matching_services: serviceMatches ?? [],
      location_note: locationNote,
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
  const customerId = input.customer_id as string | undefined;
  const customerPhone = input.customer_phone as string | undefined;
  const customerEmail = input.customer_email as string | undefined;

  // If an appointment_id is given, cancel it directly
  if (appointmentId) {
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

  // Otherwise, list all cancellable appointments for this customer
  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId && (customerPhone || customerEmail)) {
    let query = supabase.from('customers').select('id');
    if (customerEmail) query = query.eq('email', customerEmail);
    else if (customerPhone) query = query.eq('phone', customerPhone);
    const { data: cust } = await query.limit(1).single();
    resolvedCustomerId = (cust as { id: string } | null)?.id;
  }

  if (!resolvedCustomerId) {
    return { success: false, error: 'Please provide appointment_id, customer_id, customer_email, or customer_phone to identify the appointment.' };
  }

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status, services(name, price), staff(name), tenant_locations(name), tenants(name)')
    .eq('customer_id', resolvedCustomerId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) return { success: false, error: error.message };
  if (!appointments || appointments.length === 0) {
    return { success: true, data: { message: 'No upcoming cancellable appointments found.', appointments: [] } };
  }

  return {
    success: true,
    data: {
      message: `Found ${appointments.length} cancellable appointment(s). Ask the customer which one to cancel, then call cancel_appointment with the appointment_id.`,
      appointments,
    },
  };
}

// ── get_booking_details ─────────────────────────────────────────────────────

export async function handleGetBookingDetails(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const appointmentId = input.appointment_id as string | undefined;
  const customerId = input.customer_id as string | undefined;
  const customerPhone = input.customer_phone as string | undefined;
  const customerEmail = input.customer_email as string | undefined;

  // If an appointment_id is given, fetch that single appointment
  if (appointmentId) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, services(name, duration_minutes, price), staff(name), tenant_locations(name, address), tenants(name)')
      .eq('id', appointmentId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  // Otherwise, fetch ALL upcoming appointments for the customer
  let resolvedCustomerId = customerId;
  if (!resolvedCustomerId && (customerPhone || customerEmail)) {
    let query = supabase.from('customers').select('id');
    if (customerEmail) query = query.eq('email', customerEmail);
    else if (customerPhone) query = query.eq('phone', customerPhone);
    const { data: cust } = await query.limit(1).single();
    resolvedCustomerId = (cust as { id: string } | null)?.id;
  }

  if (!resolvedCustomerId) {
    return { success: false, error: 'Please provide appointment_id, customer_id, customer_email, or customer_phone.' };
  }

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status, total_price, services(name, duration_minutes, price), staff(name), tenant_locations(name, address), tenants(name)')
    .eq('customer_id', resolvedCustomerId)
    .gte('start_time', new Date().toISOString())
    .in('status', ['pending', 'confirmed'])
    .order('start_time', { ascending: true });

  if (error) return { success: false, error: error.message };
  if (!appointments || appointments.length === 0) {
    return { success: true, data: { message: 'No upcoming appointments found.', appointments: [] } };
  }

  return { success: true, data: { appointments } };
}

// ── get_packages ────────────────────────────────────────────────────────────

export async function handleGetPackages(
  supabase: AdminClient,
  tenantId: string,
  _input: Record<string, unknown>,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('packages')
    .select('*, package_services(quantity, services(name, price, duration_minutes))')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

// ── get_loyalty_info ────────────────────────────────────────────────────────

export async function handleGetLoyaltyInfo(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const customerId = input.customer_id as string;
  if (!customerId) return { success: false, error: 'customer_id is required' };

  // Fetch the loyalty program for this tenant
  const { data: program, error: programErr } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (programErr || !program) {
    return { success: true, data: { active: false } };
  }

  const loyaltyProgram = program as {
    id: string;
    is_active: boolean;
    points_per_booking: number;
    points_to_currency_rate: number;
    tiers: unknown;
    minimum_redemption_points: number;
  };

  if (!loyaltyProgram.is_active) {
    return { success: true, data: { active: false } };
  }

  // Fetch the customer's loyalty points for this tenant
  const { data: customerPoints } = await supabase
    .from('customer_loyalty_points')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  const pointsData = customerPoints as {
    points_balance: number;
    tier: string;
    lifetime_points: number;
  } | null;

  return {
    success: true,
    data: {
      active: true,
      program: {
        points_per_booking: loyaltyProgram.points_per_booking,
        points_to_currency_rate: loyaltyProgram.points_to_currency_rate,
        tiers: loyaltyProgram.tiers,
        minimum_redemption_points: loyaltyProgram.minimum_redemption_points,
      },
      customer: pointsData
        ? {
            points_balance: pointsData.points_balance,
            tier: pointsData.tier,
            lifetime_points: pointsData.lifetime_points,
          }
        : {
            points_balance: 0,
            tier: null,
            lifetime_points: 0,
          },
    },
  };
}

// ── apply_coupon ────────────────────────────────────────────────────────────

export async function handleApplyCoupon(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const couponCode = input.coupon_code as string;
  const serviceId = input.service_id as string;
  const totalPrice = input.total_price as number;

  if (!couponCode) return { success: false, error: 'coupon_code is required' };
  if (!serviceId) return { success: false, error: 'service_id is required' };
  if (totalPrice == null) return { success: false, error: 'total_price is required' };

  // Look up the coupon by code and tenant
  const { data: coupon, error: couponErr } = await supabase
    .from('coupons')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('code', couponCode)
    .limit(1)
    .single();

  if (couponErr || !coupon) {
    return { success: false, error: 'Coupon not found' };
  }

  const c = coupon as {
    id: string;
    discount_type: string;
    discount_value: number;
    expires_at: string | null;
    usage_count: number;
    usage_limit: number | null;
  };

  // Validate expiration
  if (c.expires_at && new Date(c.expires_at) < new Date()) {
    return { success: false, error: 'Coupon has expired' };
  }

  // Validate usage limit
  if (c.usage_limit !== null && c.usage_count >= c.usage_limit) {
    return { success: false, error: 'Coupon usage limit has been reached' };
  }

  // Calculate discount
  let discountAmount: number;
  if (c.discount_type === 'percentage') {
    discountAmount = (totalPrice * c.discount_value) / 100;
  } else {
    discountAmount = c.discount_value;
  }

  // Ensure discount does not exceed total price
  discountAmount = Math.min(discountAmount, totalPrice);
  const finalPrice = totalPrice - discountAmount;

  return {
    success: true,
    data: {
      valid: true,
      discount_amount: discountAmount,
      final_price: finalPrice,
      coupon_id: c.id,
    },
  };
}

// ── redeem_loyalty_points ───────────────────────────────────────────────────

export async function handleRedeemLoyaltyPoints(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const customerId = input.customer_id as string;
  const pointsToRedeem = input.points_to_redeem as number;
  const totalPrice = input.total_price as number;

  if (!customerId) return { success: false, error: 'customer_id is required' };
  if (pointsToRedeem == null) return { success: false, error: 'points_to_redeem is required' };
  if (totalPrice == null) return { success: false, error: 'total_price is required' };

  // Fetch the loyalty program for this tenant
  const { data: program, error: programErr } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (programErr || !program) {
    return { success: false, error: 'No loyalty program found for this business' };
  }

  const loyaltyProgram = program as {
    points_to_currency_rate: number;
    minimum_redemption_points: number;
    is_active: boolean;
  };

  if (!loyaltyProgram.is_active) {
    return { success: false, error: 'Loyalty program is not active' };
  }

  // Fetch the customer's loyalty points
  const { data: customerPoints, error: pointsErr } = await supabase
    .from('customer_loyalty_points')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (pointsErr || !customerPoints) {
    return { success: false, error: 'No loyalty points found for this customer' };
  }

  const pointsData = customerPoints as { points_balance: number };

  // Validate enough points
  if (pointsData.points_balance < pointsToRedeem) {
    return {
      success: false,
      error: `Insufficient points. Available: ${pointsData.points_balance}, requested: ${pointsToRedeem}`,
    };
  }

  // Validate minimum redemption threshold
  if (pointsToRedeem < loyaltyProgram.minimum_redemption_points) {
    return {
      success: false,
      error: `Minimum redemption is ${loyaltyProgram.minimum_redemption_points} points`,
    };
  }

  // Calculate discount (DON'T actually deduct points — that happens when booking is confirmed)
  const discountAmount = Math.min(
    pointsToRedeem * loyaltyProgram.points_to_currency_rate,
    totalPrice,
  );
  const finalPrice = totalPrice - discountAmount;
  const remainingPoints = pointsData.points_balance - pointsToRedeem;

  return {
    success: true,
    data: {
      valid: true,
      points_used: pointsToRedeem,
      discount_amount: discountAmount,
      final_price: finalPrice,
      remaining_points: remainingPoints,
    },
  };
}

// ── get_inventory ───────────────────────────────────────────────────────────

export async function handleGetInventory(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const serviceId = input.service_id as string | undefined;

  if (serviceId) {
    // Fetch products linked to this service via the junction table
    const { data, error } = await supabase
      .from('product_services')
      .select('products(id, name, sell_price, quantity_on_hand, display_in_booking)')
      .eq('service_id', serviceId)
      .eq('products.tenant_id', tenantId)
      .eq('products.is_active', true);

    if (error) return { success: false, error: error.message };

    // Extract products from the nested join
    const products = (data ?? [])
      .map((row) => (row as { products: unknown }).products)
      .filter(Boolean);

    return { success: true, data: products };
  }

  // Fetch all active products for the tenant
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sell_price, quantity_on_hand, display_in_booking')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

// ── get_custom_fields ───────────────────────────────────────────────────────

export async function handleGetCustomFields(
  supabase: AdminClient,
  tenantId: string,
  _input: Record<string, unknown>,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('id, name, field_type, options, is_required')
    .eq('tenant_id', tenantId)
    .eq('applies_to', 'appointment')
    .order('display_order');

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

// ── Tool dispatcher ─────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: AdminClient,
  tenantId: string,
  sessionInfo: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string },
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'find_businesses':
        return await handleFindBusinesses(supabase, tenantId, toolInput);
      case 'search_services':
      case 'get_services':
        return await handleGetServices(supabase, tenantId, toolInput);
      case 'get_service_details':
        return await handleGetServiceDetails(supabase, tenantId, toolInput);
      case 'search_tenants':
      case 'get_staff':
        return await handleGetStaff(supabase, tenantId, toolInput);
      case 'check_availability':
        return await handleCheckAvailability(supabase, tenantId, toolInput);
      case 'create_booking':
        return await handleBookAppointment(supabase, tenantId, toolInput, sessionInfo);
      case 'cancel_appointment':
        return await handleCancelAppointment(supabase, tenantId, toolInput);
      case 'get_customer_appointments':
      case 'get_booking_details':
        return await handleGetBookingDetails(supabase, tenantId, toolInput);
      case 'get_packages':
        return await handleGetPackages(supabase, tenantId, toolInput);
      case 'get_loyalty_info':
        return await handleGetLoyaltyInfo(supabase, tenantId, toolInput);
      case 'apply_coupon':
        return await handleApplyCoupon(supabase, tenantId, toolInput);
      case 'redeem_loyalty_points':
        return await handleRedeemLoyaltyPoints(supabase, tenantId, toolInput);
      case 'get_inventory':
        return await handleGetInventory(supabase, tenantId, toolInput);
      case 'get_custom_fields':
        return await handleGetCustomFields(supabase, tenantId, toolInput);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Tool execution failed';
    console.error(`[chat] Tool "${toolName}" threw an error:`, err);
    return { success: false, error: errorMessage };
  }
}
