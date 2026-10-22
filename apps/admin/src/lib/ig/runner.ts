/* Shared Instagram publishing runner: used by the cron route and the admin dashboard. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN, assetUrl, buildCaption, rowDate, type PlanRow } from './plan';
import { igAccountInfo, igCredentials, publishImage, type IgCredentials } from './publish';

export type Kind = 'feed' | 'story';

export const DEFAULT_ASSET_BASE = 'https://balkina.ai/ig';

export interface IgConfig {
  start: string | null;
  base: string;
  lang: string;
  credentials: boolean;
  login: 'instagram' | 'facebook';
}

export function igConfig(): IgConfig {
  return {
    start: process.env.IG_PLAN_START ?? null,
    base: process.env.IG_ASSET_BASE ?? DEFAULT_ASSET_BASE,
    lang: process.env.IG_LANG ?? 'sr',
    credentials: Boolean(igCredentials()),
    login: process.env.META_IG_LOGIN === 'facebook' ? 'facebook' : 'instagram',
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
      .upsert({ key: job.key, kind: job.kind, set_no: row.set, file: row.file, scheduled_for: scheduledFor, image_url: job.imageUrl, caption: job.caption ?? null, error: null }, { onConflict: 'key' });
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
export async function checkAccount(): Promise<{ ok: boolean; account?: { id: string; username?: string }; error?: string }> {
  const creds = igCredentials();
  if (!creds) return { ok: false, error: 'META_IG_USER_ID / META_IG_ACCESS_TOKEN are not set in this deployment' };
  try {
    const account = await igAccountInfo(creds);
    return { ok: true, account };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface PlanStatusRow {
  index: number;
  week: number;
  day: PlanRow['day'];
  set: number;
  file: string;
  vertical: string;
  sr: string;
  en: string;
  date: string | null;
  sq: string;
  st: string;
  feed: LogRow | null;
  story: LogRow | null;
}

/** Every plan row with its scheduled date and publish-log state. */
export async function planStatus(supabase: SupabaseClient, cfg: IgConfig): Promise<PlanStatusRow[]> {
  const { data } = await supabase.from('ig_publish_log').select('*');
  const log = new Map(((data ?? []) as LogRow[]).map((r) => [r.key, r]));
  return PLAN.map((row, index) => ({
    index,
    week: row.week,
    day: row.day,
    set: row.set,
    file: row.file,
    vertical: row.vertical,
    sr: row.sr,
    en: row.en,
    date: cfg.start ? rowDate(row, cfg.start) : null,
    sq: assetUrl(row, 'sq', cfg.base, cfg.lang),
    st: assetUrl(row, 'st', cfg.base, cfg.lang),
    feed: log.get(rowKey(row, 'feed')) ?? null,
    story: log.get(rowKey(row, 'story')) ?? null,
  }));
}
