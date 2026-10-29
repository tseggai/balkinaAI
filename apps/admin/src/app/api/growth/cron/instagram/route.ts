import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { refreshLongLivedToken, resolveIgCredentials } from '@/lib/ig/publish';
import { checkAccount, dueRows, findRow, igConfig, jobsFor, planState, publishRow, type Kind } from '@/lib/ig/runner';
import { loadSettings } from '@/lib/ig/schedule';
import { duePosts, publishPost } from '@/lib/ig/studio';

export const maxDuration = 300;

const REFRESH_WITHIN_MS = 10 * 24 * 3600 * 1000;   // refresh the DB token when it expires within 10 days
const MIN_AGE_MS = 24 * 3600 * 1000;               // Instagram refuses to refresh tokens younger than 24 h

/** Keep the DB token alive: refresh it when it is about to expire. Env tokens cannot be refreshed here. */
async function maybeRefreshToken(supabase: ReturnType<typeof createAdminClient>, cfg: Awaited<ReturnType<typeof igConfig>>): Promise<boolean> {
  if (cfg.source !== 'db' || !cfg.state.creds || !cfg.expiresAt) return false;
  const now = Date.now();
  if (Date.parse(cfg.expiresAt) - now > REFRESH_WITHIN_MS) return false;
  if (cfg.updatedAt && now - Date.parse(cfg.updatedAt) < MIN_AGE_MS) return false;
  try {
    const r = await refreshLongLivedToken(cfg.state.creds.accessToken);
    await supabase.from('ig_settings').update({ access_token: r.accessToken, token_expires_at: new Date(now + r.expiresIn * 1000).toISOString(), token_updated_at: new Date(now).toISOString() }).eq('id', 1);
    return true;
  } catch {
    return false;
  }
}

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
  const cfg = await igConfig(supabase);
  const refreshed = await maybeRefreshToken(supabase, cfg);
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
    const check = await checkAccount(supabase);
    return NextResponse.json({
      dry: true,
      paused: state.settings.paused,
      due: due.map((d) => ({ key: d.key, scheduledAt: d.scheduledAt, kinds: d.kinds })),
      duePosts: posts.map((p) => ({ id: p.id, layout: p.layout, scheduledAt: p.scheduled_at, kinds: p.kinds, attempts: p.attempts })),
      credentials: cfg.credentials,
      tokenSource: cfg.source,
      tokenExpiresAt: cfg.expiresAt,
      tokenRefreshed: refreshed,
      account: check.account ?? null,
      accountError: check.error ?? null,
    });
  }
  if (due.length === 0 && posts.length === 0) return NextResponse.json({ published: [], posts: [], skipped: state.settings.paused ? 'paused' : 'nothing due' });

  const creds = (await resolveIgCredentials(supabase)).creds;
  if (!creds) return NextResponse.json({ error: 'No Instagram token' }, { status: 500 });

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
