import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { PLAN, assetUrl, buildCaption, localDate, rowDate, rowForDate, type PlanRow } from '@/lib/ig/plan';
import { igAccountInfo, igCredentials, publishImage } from '@/lib/ig/publish';

export const maxDuration = 300;

const TZ = 'Europe/Podgorica';
const DEFAULT_ASSET_BASE = 'https://balkina.ai/ig';

type Kind = 'feed' | 'story';

interface LogRow {
  key: string;
  published_at: string | null;
  error: string | null;
}

/**
 * GET|POST /api/growth/cron/instagram
 * Publishes today's planned Instagram post (feed image + matching story) from `lib/ig/plan.ts`.
 * Auth: `Authorization: Bearer <GROWTH_CRON_SECRET>` (or Vercel CRON_SECRET).
 * Env: META_IG_USER_ID, META_IG_ACCESS_TOKEN, IG_PLAN_START (YYYY-MM-DD, the Monday of week 1),
 *      IG_ASSET_BASE (default https://balkina.ai/ig), IG_LANG (default sr).
 * Query: ?dry=1 (report only) · ?date=YYYY-MM-DD (pretend it is that day) · ?row=set1/09-photo-barber (force a row)
 *        ?only=feed|story
 * Idempotent: every feed/story is logged in ig_publish_log and never published twice.
 */
export async function POST(request: Request) {
  const secret = process.env.GROWTH_CRON_SECRET ?? process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';
  const only = url.searchParams.get('only') as Kind | null;
  const forced = url.searchParams.get('row');
  const start = process.env.IG_PLAN_START;
  const base = process.env.IG_ASSET_BASE ?? DEFAULT_ASSET_BASE;
  const lang = process.env.IG_LANG ?? 'sr';

  const today = localDate(new Date(), TZ);
  const date = url.searchParams.get('date') ?? today.date;

  let picked: { row: PlanRow; index: number } | null = null;
  if (forced) {
    const [setPart = '', file = ''] = forced.split('/');
    const set = Number(setPart.replace('set', ''));
    const index = PLAN.findIndex((r) => r.set === set && r.file === file);
    const row = PLAN[index];
    if (!row) return NextResponse.json({ error: `Unknown row ${forced}` }, { status: 400 });
    picked = { row, index };
  } else {
    if (!start) return NextResponse.json({ error: 'IG_PLAN_START is not set' }, { status: 500 });
    picked = rowForDate(date, start);
    if (!picked) return NextResponse.json({ date, skipped: 'nothing scheduled for this date' });
  }

  const { row, index } = picked;
  const scheduledFor = start ? rowDate(row, start) : date;
  type Job = { kind: Kind; key: string; imageUrl: string; caption?: string };
  const allJobs: Job[] = [
    { kind: 'feed', key: `set${row.set}/${row.file}/feed`, imageUrl: assetUrl(row, 'sq', base, lang), caption: buildCaption(row, index) },
    { kind: 'story', key: `set${row.set}/${row.file}/story`, imageUrl: assetUrl(row, 'st', base, lang) },
  ];
  const jobs = allJobs.filter((j) => !only || j.kind === only);

  const creds = igCredentials();
  if (dry) {
    let account: { id: string; username?: string } | null = null;
    let accountError: string | null = null;
    if (creds) {
      try {
        account = await igAccountInfo(creds);
      } catch (err) {
        accountError = err instanceof Error ? err.message : String(err);
      }
    }
    return NextResponse.json({ dry: true, date, scheduledFor, row: { set: row.set, file: row.file, week: row.week, day: row.day }, jobs, credentials: Boolean(creds), account, accountError });
  }
  if (!creds) return NextResponse.json({ error: 'META_IG_USER_ID / META_IG_ACCESS_TOKEN are not set' }, { status: 500 });

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('ig_publish_log')
    .select('key, published_at, error')
    .in('key', jobs.map((j) => j.key));
  const done = new Set(((existing ?? []) as LogRow[]).filter((r) => r.published_at).map((r) => r.key));

  const results: { key: string; status: 'published' | 'skipped' | 'failed'; media_id?: string; error?: string }[] = [];
  for (const job of jobs) {
    if (done.has(job.key)) {
      results.push({ key: job.key, status: 'skipped' });
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
      results.push({ key: job.key, status: 'published', media_id: r.mediaId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from('ig_publish_log').update({ error: message }).eq('key', job.key);
      results.push({ key: job.key, status: 'failed', error: message });
    }
  }

  const failed = results.some((r) => r.status === 'failed');
  return NextResponse.json({ date, scheduledFor, row: { set: row.set, file: row.file, week: row.week, day: row.day }, results }, { status: failed ? 500 : 200 });
}

// Vercel Cron calls with GET.
export const GET = POST;
