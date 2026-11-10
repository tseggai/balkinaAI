/**
 * Hospitality booking helpers shared by the chat tool handlers, the REST
 * booking routes and the notification layer (Restaurant Booking Phase 1).
 *
 * - Tables (`services.service_type = 'table'`) are request-only reservations:
 *   times come from the service `timesheet` (open hours), never staff hours.
 * - Events (`service_type = 'event'`) are capacity-gated seatings stored in
 *   `service_special_days` (date + start_time), instant-confirm.
 * - The approver / notification target is the owner staff record.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

export type Timesheet = Record<string, { enabled?: boolean; start?: string; end?: string }>;

export const isReservationType = (serviceType?: string | null): boolean => serviceType === 'table' || serviceType === 'event';

/** Convert a local date + time in a timezone to a UTC Date. */
export function localToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const asUtc = new Date(`${dateStr}T${timeStr.slice(0, 5)}:00.000Z`);
  const utcStr = asUtc.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = asUtc.toLocaleString('en-US', { timeZone: timezone });
  const offsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
  return new Date(asUtc.getTime() - offsetMs);
}

export function formatLocalTime(iso: string | Date, timezone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true });
}

export function weekdayName(date: string, timezone: string): string {
  return localToUtc(date, '12:00', timezone).toLocaleDateString('en-US', { timeZone: timezone, weekday: 'long' }).toLowerCase();
}

/**
 * The owner staff record of a tenant: the staff row linked to the tenant's
 * login, else a staff with the owner/admin role, else the first active staff.
 */
export async function resolveOwnerStaff(supabase: AdminClient, tenantId: string): Promise<{ id: string; name: string; requires_approval: boolean } | null> {
  const [{ data: tenant }, { data: staffRows }] = await Promise.all([
    supabase.from('tenants').select('user_id').eq('id', tenantId).maybeSingle(),
    supabase.from('staff').select('id, name, requires_approval, user_id, role, status, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(50),
  ]);
  const ownerUser = (tenant as { user_id: string | null } | null)?.user_id ?? null;
  const rows = ((staffRows ?? []) as { id: string; name: string; requires_approval: boolean | null; user_id: string | null; role: string | null; status: string | null }[])
    .filter((s) => s.status !== 'inactive');
  const pick = rows.find((s) => ownerUser && s.user_id === ownerUser)
    ?? rows.find((s) => s.role === 'owner' || s.role === 'admin')
    ?? rows[0];
  return pick ? { id: pick.id, name: pick.name, requires_approval: pick.requires_approval ?? false } : null;
}

export interface TimeSlot { time: string; iso: string }

/**
 * Reservation times for a table service on one date: every 30 minutes within
 * the open hours of that weekday (a `service_special_days` row overrides the
 * hours or closes the day), the last one leaving room for the turn time.
 */
export function tableTimesForDate(opts: {
  date: string;
  timesheet: Timesheet | null;
  special?: { is_day_off?: boolean | null; start_time?: string | null; end_time?: string | null } | null;
  durationMinutes: number;
  timezone: string;
  now?: number;
}): { slots: TimeSlot[]; open: { start: string; end: string } | null; closed: boolean } {
  const { date, timesheet, special, durationMinutes, timezone } = opts;
  if (special?.is_day_off) return { slots: [], open: null, closed: true };
  const day = timesheet?.[weekdayName(date, timezone)];
  let start = special?.start_time?.slice(0, 5) ?? (day?.enabled !== false ? day?.start : undefined);
  let end = special?.end_time?.slice(0, 5) ?? (day?.enabled !== false ? day?.end : undefined);
  if (!start || !end) return { slots: [], open: null, closed: true };
  start = start.slice(0, 5); end = end.slice(0, 5);
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const startMin = toMin(start), endMin = toMin(end);
  const lastStart = Math.max(startMin, endMin - durationMinutes);
  const nowPlus15 = (opts.now ?? Date.now()) + 15 * 60000;
  const slots: TimeSlot[] = [];
  for (let m = startMin; m <= lastStart; m += 30) {
    const hm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const at = localToUtc(date, hm, timezone);
    if (at.getTime() < nowPlus15) continue;
    slots.push({ time: formatLocalTime(at, timezone), iso: at.toISOString() });
  }
  return { slots, open: { start, end }, closed: false };
}

export interface Seating { date: string; start_time: string | null; time: string; iso: string; seats_left: number; capacity: number }

/**
 * Upcoming seatings for event services with the seats still free:
 * capacity − SUM(party_size) of pending/approved/confirmed bookings at that seating.
 */
export async function eventSeatings(
  supabase: AdminClient,
  services: { id: string; capacity: number | null }[],
  timezone: string,
  opts: { includePast?: boolean; now?: number } = {},
): Promise<Map<string, Seating[]>> {
  const out = new Map<string, Seating[]>();
  if (services.length === 0) return out;
  const ids = services.map((s) => s.id);
  const [{ data: dayRows }, { data: apptRows }] = await Promise.all([
    supabase.from('service_special_days').select('service_id, date, start_time, is_day_off').in('service_id', ids),
    supabase.from('appointments').select('service_id, start_time, party_size').in('service_id', ids).in('status', ['pending', 'confirmed', 'approved']),
  ]);
  const taken = new Map<string, number>();
  for (const a of (apptRows ?? []) as { service_id: string; start_time: string; party_size: number | null }[]) {
    const key = `${a.service_id}|${new Date(a.start_time).toISOString()}`;
    taken.set(key, (taken.get(key) ?? 0) + (a.party_size ?? 1));
  }
  const now = opts.now ?? Date.now();
  for (const svc of services) {
    const seatings = ((dayRows ?? []) as { service_id: string; date: string; start_time: string | null; is_day_off: boolean | null }[])
      .filter((d) => d.service_id === svc.id && !d.is_day_off && d.date)
      .map((d) => {
        const at = localToUtc(d.date, (d.start_time ?? '00:00').slice(0, 5), timezone);
        const iso = at.toISOString();
        const capacity = svc.capacity ?? 0;
        return { date: d.date, start_time: d.start_time, time: formatLocalTime(at, timezone), iso, seats_left: capacity - (taken.get(`${svc.id}|${iso}`) ?? 0), capacity };
      })
      .filter((s) => opts.includePast || new Date(s.iso).getTime() > now)
      .sort((a, b) => a.iso.localeCompare(b.iso));
    out.set(svc.id, seatings);
  }
  return out;
}

/** Timezone of a tenant's first location (or a specific location), default UTC. */
export async function tenantTimezone(supabase: AdminClient, tenantId: string, locationId?: string | null): Promise<string> {
  if (locationId) {
    const { data } = await supabase.from('tenant_locations').select('timezone').eq('id', locationId).maybeSingle();
    const tz = (data as { timezone: string | null } | null)?.timezone;
    if (tz) return tz;
  }
  const { data } = await supabase.from('tenant_locations').select('timezone').eq('tenant_id', tenantId).limit(1).maybeSingle();
  return (data as { timezone: string | null } | null)?.timezone || 'UTC';
}
