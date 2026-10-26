import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { igCredentials } from '@/lib/ig/publish';
import { checkAccount, dueRows, findRow, igConfig, jobsFor, planState, publishRow, type Kind } from '@/lib/ig/runner';
import { loadSettings } from '@/lib/ig/schedule';
import { duePosts, publishPost } from '@/lib/ig/studio';

export const maxDuration = 300;

/**
 * GET|POST /api/growth/cron/instagram
 * Publishes every plan row whose effective time (settings cadence or per-row override) has passed
 * and which still has a feed/story to post, then every scheduled studio post (ig_posts) that is due.
 * Called every 15 min by pg_cron (Migration 072) and daily by Vercel cron as a fallback.
 * Idempotent via ig_publish_log / ig_posts.
 * Auth: `Authorization: Bearer <GROWTH_CRON_SECRET | CRON_SECRET | ig_settings.cron_secret>`.
 * Query: ?dry=1 (list what is due, check the token) · ?row=set1/09-photo-barber (force one row) · ?only=feed|story
 */
export async function POST(request: Request) {
  const supabase = createAdminClient();
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const envSecret = process.env.GROWTH_CRON_SECRET ?? process.env.CRON_SECRET;
  const dbSecret = (await loadSettings(supabase)).cron_secret;
  const ok = bearer.length > 0 && ((envSecret && bearer === envSecret) || (dbSecret && bearer === dbSecret));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';
  const only = url.searchParams.get('only') as Kind | null;
  const forced = url.searchParams.get('row');
  const cfg = igConfig();
  const state = await planState(supabase, cfg);

  let due = dueRows(state);
  if (forced) {
    const [setPart = '', file = ''] = forced.split('/');
    const picked = findRow(Number(setPart.replace('set', '')), file);
    if (!picked) return NextResponse.json({ error: `Unknown row ${forced}` }, { status: 400 });
    const key = `set${picked.row.set}/${picked.row.file}`;
    const sched = state.rows.find((r) => r.key === key);
    due = [{ row: picked.row, index: picked.index, key, scheduledAt: sched?.scheduledAt ?? new Date().toISOString(), kinds: only ? [only] : ['feed', 'story'] }];
  } else if (only) {
    due = due.map((d) => ({ ...d, kinds: d.kinds.filter((k) => k === only) })).filter((d) => d.kinds.length > 0);
  }

  // Studio posts follow the same pause switch as the plan; a forced plan row does not touch them.
  const posts = forced || state.settings.paused ? [] : await duePosts(supabase);

  if (dry) {
    const check = await checkAccount();
    return NextResponse.json({
      dry: true,
      paused: state.settings.paused,
      due: due.map((d) => ({ key: d.key, scheduledAt: d.scheduledAt, kinds: d.kinds })),
      duePosts: posts.map((p) => ({ id: p.id, layout: p.layout, scheduledAt: p.scheduled_at, kinds: p.kinds, attempts: p.attempts })),
      credentials: cfg.credentials,
      account: check.account ?? null,
      accountError: check.error ?? null,
    });
  }
  if (due.length === 0 && posts.length === 0) return NextResponse.json({ published: [], posts: [], skipped: state.settings.paused ? 'paused' : 'nothing due' });

  const creds = igCredentials();
  if (!creds) return NextResponse.json({ error: 'META_IG_ACCESS_TOKEN is not set' }, { status: 500 });

  const results = [];
  for (const d of due) {
    const r = await publishRow(supabase, creds, d.row, jobsFor(d.row, d.index, cfg, d.kinds), d.scheduledAt.slice(0, 10));
    results.push({ key: d.key, results: r });
  }
  const postResults = [];
  for (const p of posts) {
    const r = await publishPost(supabase, creds, p);
    postResults.push({ id: p.id, results: r.results });
  }
  const failed = results.some((r) => r.results.some((x) => x.status === 'failed')) || postResults.some((r) => r.results.some((x) => x.status === 'failed'));
  return NextResponse.json({ published: results, posts: postResults }, { status: failed ? 500 : 200 });
}

// Vercel Cron calls with GET.
export const GET = POST;
