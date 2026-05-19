const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://app.balkina.ai';

export interface StaffSlot {
  time: string;
  iso: string;
}

export interface StaffData {
  id: string;
  name: string;
  image_url: string | null;
  available_slots_count: number;
  slots: StaffSlot[];
  all_slots?: { time: string; iso: string; available: boolean }[];
}

export interface AvailabilityResponse {
  date: string;
  service_duration_minutes: number;
  staff_selection_enabled: boolean;
  pricing_type?: string;
  staff: StaffData[];
  anyone_slots: { time: string; iso: string; available: boolean }[];
  address?: string;
  currency?: string;
}

export interface CreateBookingResponse {
  success: boolean;
  appointment_id?: string;
  status?: string;
  service_name?: string;
  staff_name?: string;
  business_name?: string;
  date?: string;
  time?: string;
  address?: string;
  total?: number;
  deposit_amount?: number;
  payment_required?: boolean;
  payment_url?: string;
  error?: string;
}

export async function fetchStaffAvailability(params: {
  tenantId: string;
  serviceId: string;
  date: string;
  locationId?: string;
}): Promise<AvailabilityResponse | { error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/booking/staff-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: params.tenantId,
        serviceId: params.serviceId,
        date: params.date,
        locationId: params.locationId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: (data as { error?: string }).error || `API error ${res.status}` };
    }
    return data as AvailabilityResponse;
  } catch (err) {
    return { error: `Network error: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

export async function createBooking(params: {
  tenantId: string;
  serviceId: string;
  staffId?: string | null;
  date: string;
  timeSlot: string;
  timeSlotIso?: string;
  locationId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
}): Promise<CreateBookingResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/booking/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Booking failed' };
    return data;
  } catch {
    return { success: false, error: 'Network error. Please try again.' };
  }
}
