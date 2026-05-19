import { createAdminClient } from '@/lib/supabase/server';
import { fetchGoogleCalendarEvents } from '@/lib/google-calendar';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ParsedEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
}

function parseICalEvents(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const blocks = text.split('BEGIN:VEVENT');

  for (let i = 1; i < blocks.length; i++) {
    const block = (blocks[i] ?? '').split('END:VEVENT')[0];
    if (!block) continue;

    let uid = '';
    let dtstart = '';
    let dtend = '';
    let summary = '';

    for (const line of unfoldLines(block)) {
      const stripped = line.trim();
      if (stripped.startsWith('UID:') || stripped.startsWith('UID;')) uid = extractValue(stripped);
      else if (stripped.startsWith('DTSTART')) dtstart = extractDateValue(stripped);
      else if (stripped.startsWith('DTEND')) dtend = extractDateValue(stripped);
      else if (stripped.startsWith('SUMMARY:') || stripped.startsWith('SUMMARY;')) summary = extractValue(stripped);
    }

    if (!dtstart) continue;
    const start = parseICalDate(dtstart);
    const end = dtend ? parseICalDate(dtend) : new Date(start.getTime() + 3600000);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    events.push({
      uid: uid || `${start.toISOString()}-${end.toISOString()}`,
      start,
      end,
      summary: summary.slice(0, 200),
    });
  }

  return events;
}

function unfoldLines(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, '').replace(/\r/g, '').split('\n');
}

function extractValue(line: string): string {
  const idx = line.indexOf(':');
  return idx >= 0 ? line.slice(idx + 1).trim() : '';
}

function extractDateValue(line: string): string {
  const idx = line.indexOf(':');
  return idx >= 0 ? line.slice(idx + 1).trim() : '';
}

function parseICalDate(value: string): Date {
  const clean = value.replace(/[^0-9TZ]/g, '');
  if (clean.length === 8) {
    return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00Z`);
  }
  if (clean.length >= 15) {
    const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`;
    return clean.endsWith('Z') ? new Date(iso + 'Z') : new Date(iso);
  }
  return new Date(value);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: calendars } = await supabase
    .from('staff_external_calendars')
    .select('id, staff_id, ical_url, name')
    .eq('is_active', true);

  if (!calendars || calendars.length === 0) {
    return Response.json({ synced: 0 });
  }

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 7);
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 90);

  let synced = 0;
  let errors = 0;

  for (const cal of calendars as { id: string; staff_id: string; ical_url: string; name: string }[]) {
    try {
      const res = await fetch(cal.ical_url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const allEvents = parseICalEvents(text);

      const events = allEvents.filter((e) => e.end > windowStart && e.start < windowEnd);

      const { data: existing } = await supabase
        .from('external_calendar_events')
        .select('uid')
        .eq('external_calendar_id', cal.id);

      const existingUids = new Set(((existing ?? []) as { uid: string }[]).map((e) => e.uid));
      const newUids = new Set(events.map((e) => e.uid));

      const toDelete = [...existingUids].filter((uid) => !newUids.has(uid));
      if (toDelete.length > 0) {
        await supabase
          .from('external_calendar_events')
          .delete()
          .eq('external_calendar_id', cal.id)
          .in('uid', toDelete);
      }

      for (const event of events) {
        await supabase
          .from('external_calendar_events')
          .upsert({
            external_calendar_id: cal.id,
            staff_id: cal.staff_id,
            uid: event.uid,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
            summary: event.summary,
          } as never, { onConflict: 'external_calendar_id,uid' });
      }

      await supabase
        .from('staff_external_calendars')
        .update({ last_synced_at: now.toISOString(), last_error: null } as never)
        .eq('id', cal.id);

      synced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await supabase
        .from('staff_external_calendars')
        .update({ last_error: msg } as never)
        .eq('id', cal.id);
      errors++;
    }
  }

  // Phase 2: Sync Google Calendar connections
  let gcalSynced = 0;
  let gcalErrors = 0;

  const { data: gcalConns } = await supabase
    .from('staff_google_calendar_connections')
    .select('id, staff_id, access_token, refresh_token, token_expires_at, calendar_id')
    .eq('is_active', true);

  for (const conn of (gcalConns ?? []) as { id: string; staff_id: string; access_token: string; refresh_token: string; token_expires_at: string; calendar_id: string }[]) {
    try {
      const events = await fetchGoogleCalendarEvents(conn, windowStart, windowEnd);

      const { data: existing } = await supabase
        .from('external_calendar_events')
        .select('uid')
        .eq('external_calendar_id', conn.id);

      const existingUids = new Set(((existing ?? []) as { uid: string }[]).map((e) => e.uid));
      const newUids = new Set(events.map((e) => e.uid));

      const toDelete = [...existingUids].filter((uid) => !newUids.has(uid));
      if (toDelete.length > 0) {
        await supabase
          .from('external_calendar_events')
          .delete()
          .eq('external_calendar_id', conn.id)
          .in('uid', toDelete);
      }

      for (const event of events) {
        await supabase
          .from('external_calendar_events')
          .upsert({
            external_calendar_id: conn.id,
            staff_id: conn.staff_id,
            uid: event.uid,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
            summary: event.summary,
          } as never, { onConflict: 'external_calendar_id,uid' });
      }

      gcalSynced++;
    } catch {
      gcalErrors++;
    }
  }

  return Response.json({
    ical: { synced, errors, total: calendars.length },
    google: { synced: gcalSynced, errors: gcalErrors, total: (gcalConns ?? []).length },
  });
}
