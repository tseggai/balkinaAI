import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { igConfig, planState } from '@/lib/ig/runner';
import { zonedToUtc } from '@/lib/ig/schedule';

const Body = z.object({
  keys: z.array(z.string().min(1)).min(1).max(40),
  // Exactly one of:
  set: z
    .object({
      scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
      enabled: z.boolean().optional(),
      kinds: z.array(z.enum(['feed', 'story'])).min(1).optional(),
    })
    .optional(),
  shift_days: z.number().int().min(-365).max(365).optional(),   // move each row's effective time by N days
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),            // set the local time, keep the date
  clear: z.boolean().optional(),                                  // drop overrides → back to plan cadence
});

// POST /api/admin/ig/overrides — individual or bulk schedule changes for plan rows.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { keys, set, shift_days, time, clear } = parsed.data;

  const state = await planState(auth.supabase, await igConfig(auth.supabase));
  const rows = state.rows.filter((r) => keys.includes(r.key));
  if (rows.length === 0) return NextResponse.json({ error: 'No matching rows' }, { status: 404 });
  const tz = state.settings.timezone;

  if (clear) {
    const { error } = await auth.supabase.from('ig_overrides').delete().in('key', rows.map((r) => r.key));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: rows.length });
  }

  const upserts = rows.map((r) => {
    const next: { key: string; scheduled_at?: string | null; enabled?: boolean; kinds?: string[]; updated_at: string } = { key: r.key, updated_at: new Date().toISOString() };
    const current = r.scheduledAt ? new Date(r.scheduledAt) : null;
    if (shift_days !== undefined && current) {
      // Shift by whole days in local wall-clock terms (keeps the local time across DST).
      const local = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(current);
      const get = (t: string) => local.find((p) => p.type === t)?.value ?? '00';
      const d = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + shift_days);
      next.scheduled_at = zonedToUtc(d.toISOString().slice(0, 10), `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`, tz).toISOString();
    }
    if (time && current) {
      const local = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(current);
      next.scheduled_at = zonedToUtc(local, time, tz).toISOString();
    }
    if (set?.scheduled_at !== undefined) next.scheduled_at = set.scheduled_at;
    if (set?.enabled !== undefined) next.enabled = set.enabled;
    if (set?.kinds !== undefined) next.kinds = set.kinds;
    // Keep existing override fields we are not touching.
    const existing = state.overrides.find((o) => o.key === r.key);
    if (existing) {
      if (next.scheduled_at === undefined) next.scheduled_at = existing.scheduled_at;
      if (next.enabled === undefined) next.enabled = existing.enabled;
      if (next.kinds === undefined) next.kinds = existing.kinds;
    }
    return next;
  });

  const { error } = await auth.supabase.from('ig_overrides').upsert(upserts, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: upserts.length });
}
