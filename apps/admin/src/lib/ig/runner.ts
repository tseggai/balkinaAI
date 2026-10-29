/* Shared Instagram publishing runner: used by the cron route and the admin dashboard. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN, assetUrl, buildCaption, type PlanRow } from './plan';
import { igAccountInfo, publishImage, resolveIgCredentials, type IgCredentialState, type IgCredentials } from './publish';
import { effectiveSchedule, loadOverrides, loadSettings, planKey, type IgOverride, type IgSettings, type Kind, type RowSchedule } from './schedule';

export type { Kind } from './schedule';

export const DEFAULT_ASSET_BASE = 'https://balkina.ai/ig';

export interface IgConfig {
  base: string;
  lang: string;
  credentials: boolean;
  source: 'db' | 'env' | null;
  username: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  login: 'instagram' | 'facebook';
}

/** Asset base, language and the state of the Instagram token (DB first, env fallback). */
export async function igConfig(supabase: SupabaseClient): Promise<IgConfig & { state: IgCredentialState }> {
  const state = await resolveIgCredentials(supabase);
  return {
    base: process.env.IG_ASSET_BASE ?? DEFAULT_ASSET_BASE,
    lang: process.env.IG_LANG ?? 'sr',
    credentials: Boolean(state.creds),
    source: state.source,
    username: state.username,
    expiresAt: state.expiresAt,
    updatedAt: state.updatedAt,
    login: process.env.META_IG_LOGIN === 'facebook' ? 'facebook' : 'instagram',
    state,
  };
}

export interface LogRow {
  key: string;
  kind: Kind;
  set_no: number;
  file: string;
  scheduled_for: string;
  image_url: string;
  caption: string | null;
  ig_media_id: string | null;
  published_at: string | null;
  error: string | null;
  attempts: number;
  attempted_at: string | null;
  created_at: string;
}

export interface Job {
  kind: Kind;
  key: string;
  imageUrl: string;
  caption?: string;
}

export const rowKey = (row: PlanRow, kind: Kind) => `set${row.set}/${row.file}/${kind}`;

export function jobsFor(row: PlanRow, index: number, cfg: IgConfig, kinds: Kind[] = ['feed', 'story']): Job[] {
  const all: Job[] = [
    { kind: 'feed', key: rowKey(row, 'feed'), imageUrl: assetUrl(row, 'sq', cfg.base, cfg.lang), caption: buildCaption(row, index) },
    { kind: 'story', key: rowKey(row, 'story'), imageUrl: assetUrl(row, 'st', cfg.base, cfg.lang) },
  ];
  return all.filter((j) => kinds.includes(j.kind));
}

export function findRow(set: number, file: string): { row: PlanRow; index: number } | null {
  const index = PLAN.findIndex((r) => r.set === set && r.file === file);
  const row = PLAN[index];
  return row ? { row, index } : null;
}

export interface PublishOutcome {
  key: string;
  kind: Kind;
  status: 'published' | 'skipped' | 'failed';
  media_id?: string;
  error?: string;
}

/** Publish the given jobs for a row, logging to ig_publish_log. Already-published keys are skipped. */
export async function publishRow(
  supabase: SupabaseClient,
  creds: IgCredentials,
  row: PlanRow,
  jobs: Job[],
  scheduledFor: string
): Promise<PublishOutcome[]> {
  const { data: existing } = await supabase
    .from('ig_publish_log')
    .select('key, published_at')
    .in('key', jobs.map((j) => j.key));
  const done = new Set(((existing ?? []) as { key: string; published_at: string | null }[]).filter((r) => r.published_at).map((r) => r.key));

  const results: PublishOutcome[] = [];
  for (const job of jobs) {
    if (done.has(job.key)) {
      results.push({ key: job.key, kind: job.kind, status: 'skipped' });
      continue;
    }
    await supabase
      .from('ig_publish_log')
      .upsert({ key: job.key, kind: job.kind, set_no: row.set, file: row.file, scheduled_for: scheduledFor, image_url: job.imageUrl, caption: job.caption ?? null, error: null, attempted_at: new Date().toISOString() }, { onConflict: 'key' });
    await supabase.rpc('ig_publish_log_bump', { p_key: job.key }).then(() => undefined, () => undefined);
    try {
      const r = await publishImage(creds, { kind: job.kind, imageUrl: job.imageUrl, caption: job.caption });
      await supabase
        .from('ig_publish_log')
        .update({ ig_media_id: r.mediaId, ig_container_id: r.containerId, published_at: new Date().toISOString() })
        .eq('key', job.key);
      results.push({ key: job.key, kind: job.kind, status: 'published', media_id: r.mediaId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from('ig_publish_log').update({ error: message }).eq('key', job.key);
      results.push({ key: job.key, kind: job.kind, status: 'failed', error: message });
    }
  }
  return results;
}

/** Token sanity check: who does this token belong to? */
export async function checkAccount(supabase: SupabaseClient): Promise<{ ok: boolean; source?: 'db' | 'env'; account?: { id: string; user_id?: string; username?: string }; error?: string }> {
  const state = await resolveIgCredentials(supabase);
  if (!state.creds) return { ok: false, error: 'No Instagram token: paste one on the Instagram page (or set META_IG_ACCESS_TOKEN in Vercel)' };
  try {
    const account = await igAccountInfo(state.creds);
    return { ok: true, source: state.source ?? undefined, account };
  } catch (err) {
    return { ok: false, source: state.source ?? undefined, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface PlanStatusRow extends RowSchedule {
  index: number;
  key: string;
  set: number;
  file: string;
  vertical: string;
  sr: string;
  en: string;
  sq: string;
  st: string;
  feed: LogRow | null;
  story: LogRow | null;
}

export interface PlanState {
  settings: IgSettings;
  overrides: IgOverride[];
  rows: PlanStatusRow[];
}

/** Every plan row with its effective schedule and publish-log state. */
export async function planState(supabase: SupabaseClient, cfg: IgConfig): Promise<PlanState> {
  const [settingsRow, overrides, logRes] = await Promise.all([loadSettings(supabase), loadOverrides(supabase), supabase.from('ig_publish_log').select('*')]);
  const { cron_secret: _secret, ...settings } = settingsRow;
  void _secret;
  const log = new Map(((logRes.data ?? []) as LogRow[]).map((r) => [r.key, r]));
  const sched = effectiveSchedule(settings, overrides);
  const rows = PLAN.map((row, index) => {
    const key = planKey(row);
    const s = sched.get(key) ?? { scheduledAt: null, source: 'plan' as const, enabled: true, kinds: ['feed', 'story'] as Kind[] };
    return {
      index,
      key,
      set: row.set,
      file: row.file,
      vertical: row.vertical,
      sr: row.sr,
      en: row.en,
      sq: assetUrl(row, 'sq', cfg.base, cfg.lang),
      st: assetUrl(row, 'st', cfg.base, cfg.lang),
      feed: log.get(rowKey(row, 'feed')) ?? null,
      story: log.get(rowKey(row, 'story')) ?? null,
      ...s,
    };
  });
  return { settings, overrides, rows };
}

const GRACE_MS = 36 * 3600 * 1000;      // a missed slot is still posted within 36h
const RETRY_MS = 2 * 3600 * 1000;       // failed attempts are retried every 2h
const MAX_ATTEMPTS = 3;
const MAX_PER_RUN = 3;

export interface DueJob {
  row: PlanRow;
  index: number;
  key: string;
  scheduledAt: string;
  kinds: Kind[];
}

/** Rows whose effective time has passed and which still have something to publish. */
export function dueRows(state: PlanState, now = new Date()): DueJob[] {
  if (state.settings.paused) return [];
  const t = now.getTime();
  const out: DueJob[] = [];
  for (const r of state.rows) {
    if (!r.enabled || !r.scheduledAt) continue;
    const at = Date.parse(r.scheduledAt);
    if (at > t || t - at > GRACE_MS) continue;
    const pending = r.kinds.filter((k) => {
      const log = k === 'feed' ? r.feed : r.story;
      if (!log) return true;
      if (log.published_at) return false;
      if (log.attempts >= MAX_ATTEMPTS) return false;
      return !log.attempted_at || t - Date.parse(log.attempted_at) > RETRY_MS;
    });
    if (pending.length === 0) continue;
    const row = PLAN[r.index];
    if (!row) continue;
    out.push({ row, index: r.index, key: r.key, scheduledAt: r.scheduledAt, kinds: pending });
    if (out.length >= MAX_PER_RUN) break;
  }
  return out;
}
