import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { localDate, rowDate, rowForDate, type PlanRow } from '@/lib/ig/plan';
import { igCredentials } from '@/lib/ig/publish';
import { checkAccount, findRow, igConfig, jobsFor, publishRow, type Kind } from '@/lib/ig/runner';

export const maxDuration = 300;

const TZ = 'Europe/Podgorica';

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
  const cfg = igConfig();

  const today = localDate(new Date(), TZ);
  const date = url.searchParams.get('date') ?? today.date;

  let picked: { row: PlanRow; index: number } | null = null;
  if (forced) {
    const [setPart = '', file = ''] = forced.split('/');
    picked = findRow(Number(setPart.replace('set', '')), file);
    if (!picked) return NextResponse.json({ error: `Unknown row ${forced}` }, { status: 400 });
  } else {
    if (!cfg.start) return NextResponse.json({ error: 'IG_PLAN_START is not set' }, { status: 500 });
    picked = rowForDate(date, cfg.start);
    if (!picked) return NextResponse.json({ date, skipped: 'nothing scheduled for this date' });
  }

  const { row, index } = picked;
  const scheduledFor = cfg.start ? rowDate(row, cfg.start) : date;
  const jobs = jobsFor(row, index, cfg, only ? [only] : ['feed', 'story']);

  if (dry) {
    const check = await checkAccount();
    return NextResponse.json({ dry: true, date, scheduledFor, row: { set: row.set, file: row.file, week: row.week, day: row.day }, jobs, credentials: cfg.credentials, account: check.account ?? null, accountError: check.error ?? null });
  }
  const creds = igCredentials();
  if (!creds) return NextResponse.json({ error: 'META_IG_USER_ID / META_IG_ACCESS_TOKEN are not set' }, { status: 500 });

  const results = await publishRow(createAdminClient(), creds, row, jobs, scheduledFor);
  const failed = results.some((r) => r.status === 'failed');
  return NextResponse.json({ date, scheduledFor, row: { set: row.set, file: row.file, week: row.week, day: row.day }, results }, { status: failed ? 500 : 200 });
}

// Vercel Cron calls with GET.
export const GET = POST;
