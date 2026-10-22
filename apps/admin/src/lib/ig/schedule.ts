/* Instagram schedule: settings (cadence, time, timezone) + per-row overrides → effective posting time per row. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN, type PlanRow } from './plan';

export type Kind = 'feed' | 'story';

export interface IgSettings {
  start_date: string | null;
  post_time: string;
  days: number[];
  timezone: string;
  paused: boolean;
}

export interface IgOverride {
  key: string;
  scheduled_at: string | null;
  enabled: boolean;
  kinds: Kind[];
}

export interface RowSchedule {
  scheduledAt: string | null; // ISO UTC
  source: 'plan' | 'override';
  enabled: boolean;
  kinds: Kind[];
}

export const DEFAULT_SETTINGS: IgSettings = { start_date: null, post_time: '18:00', days: [1, 3, 5], timezone: 'Europe/Podgorica', paused: false };

export const planKey = (row: PlanRow) => `set${row.set}/${row.file}`;

/** UTC offset (minutes) of a timezone at a given instant. */
function tzOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Local wall-clock date + time in a timezone → UTC instant. Handles DST with a second pass. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const first = new Date(naive - tzOffsetMinutes(new Date(naive), timeZone) * 60_000);
  return new Date(naive - tzOffsetMinutes(first, timeZone) * 60_000);
}

/** The n-th posting date (YYYY-MM-DD) on or after start_date whose ISO weekday is in `days`. */
export function planDates(settings: IgSettings, count = PLAN.length): (string | null)[] {
  if (!settings.start_date || settings.days.length === 0) return Array.from({ length: count }, () => null);
  const allowed = new Set(settings.days);
  const out: string[] = [];
  const d = new Date(`${settings.start_date}T00:00:00Z`);
  let guard = 0;
  while (out.length < count && guard++ < 2000) {
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (allowed.has(iso)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Effective schedule for every plan row, by key. */
export function effectiveSchedule(settings: IgSettings, overrides: IgOverride[]): Map<string, RowSchedule> {
  const byKey = new Map(overrides.map((o) => [o.key, o]));
  const dates = planDates(settings);
  const out = new Map<string, RowSchedule>();
  PLAN.forEach((row, i) => {
    const key = planKey(row);
    const o = byKey.get(key);
    const planDate = dates[i] ?? null;
    const planAt = planDate ? zonedToUtc(planDate, settings.post_time, settings.timezone).toISOString() : null;
    out.set(key, {
      scheduledAt: o?.scheduled_at ?? planAt,
      source: o?.scheduled_at ? 'override' : 'plan',
      enabled: o ? o.enabled : true,
      kinds: o ? o.kinds : ['feed', 'story'],
    });
  });
  return out;
}

export async function loadSettings(supabase: SupabaseClient): Promise<IgSettings & { cron_secret: string | null }> {
  const { data } = await supabase.from('ig_settings').select('start_date, post_time, days, timezone, paused, cron_secret').eq('id', 1).maybeSingle();
  const row = (data ?? {}) as Partial<IgSettings & { cron_secret: string }>;
  return {
    start_date: row.start_date ?? process.env.IG_PLAN_START ?? null,
    post_time: row.post_time ?? DEFAULT_SETTINGS.post_time,
    days: row.days ?? DEFAULT_SETTINGS.days,
    timezone: row.timezone ?? DEFAULT_SETTINGS.timezone,
    paused: row.paused ?? false,
    cron_secret: row.cron_secret ?? null,
  };
}

export async function loadOverrides(supabase: SupabaseClient): Promise<IgOverride[]> {
  const { data } = await supabase.from('ig_overrides').select('key, scheduled_at, enabled, kinds');
  return (data ?? []) as IgOverride[];
}
