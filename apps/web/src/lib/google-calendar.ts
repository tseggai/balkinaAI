import { createAdminClient } from './supabase/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface GoogleConnection {
  id: string;
  staff_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  calendar_id: string;
}

async function refreshAccessToken(connection: GoogleConnection): Promise<string> {
  if (new Date(connection.token_expires_at) > new Date(Date.now() + 60000)) {
    return connection.access_token;
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

  const data = await res.json() as { access_token: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const supabase = createAdminClient();
  await supabase
    .from('staff_google_calendar_connections')
    .update({ access_token: data.access_token, token_expires_at: expiresAt } as never)
    .eq('id', connection.id);

  return data.access_token;
}

async function getConnectionForStaff(staffId: string): Promise<GoogleConnection | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('staff_google_calendar_connections')
    .select('id, staff_id, access_token, refresh_token, token_expires_at, calendar_id')
    .eq('staff_id', staffId)
    .eq('is_active', true)
    .single();

  return data as GoogleConnection | null;
}

export async function pushEventToGoogleCalendar(appointmentId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, staff_id, start_time, end_time, google_calendar_event_id, services(name), customers(display_name, phone, email), tenant_locations(name, address)')
    .eq('id', appointmentId)
    .single();

  if (!appt) return;
  const a = appt as unknown as {
    id: string; staff_id: string; start_time: string; end_time: string; google_calendar_event_id: string | null;
    services: { name: string } | null; customers: { display_name: string; phone: string | null; email: string | null } | null;
    tenant_locations: { name: string; address: string | null } | null;
  };

  if (!a.staff_id) return;
  if (a.google_calendar_event_id) return;

  const conn = await getConnectionForStaff(a.staff_id);
  if (!conn) return;

  const accessToken = await refreshAccessToken(conn);
  const svcName = a.services?.name ?? 'Appointment';
  const custName = a.customers?.display_name ?? 'Customer';
  const custPhone = a.customers?.phone ?? '';
  const custEmail = a.customers?.email ?? '';
  const location = a.tenant_locations?.address ?? a.tenant_locations?.name ?? '';

  const event = {
    summary: `${svcName} — ${custName}`,
    description: [
      `Client: ${custName}`,
      custPhone ? `Phone: ${custPhone}` : null,
      custEmail ? `Email: ${custEmail}` : null,
      'Booked via Balkina AI',
    ].filter(Boolean).join('\n'),
    location,
    start: { dateTime: a.start_time },
    end: { dateTime: a.end_time },
    reminders: { useDefault: true },
  };

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${conn.calendar_id}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (res.ok) {
    const created = await res.json() as { id: string };
    await supabase
      .from('appointments')
      .update({ google_calendar_event_id: created.id } as never)
      .eq('id', appointmentId);
  }
}

export async function deleteGoogleCalendarEvent(appointmentId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: appt } = await supabase
    .from('appointments')
    .select('staff_id, google_calendar_event_id')
    .eq('id', appointmentId)
    .single();

  if (!appt) return;
  const a = appt as { staff_id: string | null; google_calendar_event_id: string | null };
  if (!a.staff_id || !a.google_calendar_event_id) return;

  const conn = await getConnectionForStaff(a.staff_id);
  if (!conn) return;

  const accessToken = await refreshAccessToken(conn);

  await fetch(`${GOOGLE_CALENDAR_API}/calendars/${conn.calendar_id}/events/${a.google_calendar_event_id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  await supabase
    .from('appointments')
    .update({ google_calendar_event_id: null } as never)
    .eq('id', appointmentId);
}

export async function fetchGoogleCalendarEvents(connection: GoogleConnection, windowStart: Date, windowEnd: Date) {
  const accessToken = await refreshAccessToken(connection);

  const params = new URLSearchParams({
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
    singleEvents: 'true',
    maxResults: '500',
    orderBy: 'startTime',
  });

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${connection.calendar_id}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);

  const data = await res.json() as {
    items: { id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; status: string }[];
  };

  return (data.items ?? [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      uid: e.id,
      summary: e.summary ?? '',
      start: new Date(e.start.dateTime ?? e.start.date ?? ''),
      end: new Date(e.end.dateTime ?? e.end.date ?? ''),
    }))
    .filter((e) => !isNaN(e.start.getTime()) && !isNaN(e.end.getTime()));
}
