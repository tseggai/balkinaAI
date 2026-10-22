'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, SECTION_TITLE, SELECT } from '@/components/prospect-crm';

type Kind = 'feed' | 'story';

interface LogRow {
  key: string;
  kind: Kind;
  ig_media_id: string | null;
  published_at: string | null;
  error: string | null;
}

interface PlanRow {
  index: number;
  week: number;
  day: 'Mon' | 'Wed' | 'Fri';
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

interface Config {
  start: string | null;
  base: string;
  lang: string;
  credentials: boolean;
  login: 'instagram' | 'facebook';
}

interface Outcome {
  key: string;
  kind: Kind;
  status: 'published' | 'skipped' | 'failed';
  media_id?: string;
  error?: string;
}

const DAY: Record<PlanRow['day'], string> = { Mon: 'Monday', Wed: 'Wednesday', Fri: 'Friday' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatePill({ log, today, date }: { log: LogRow | null; today: string; date: string | null }) {
  if (log?.published_at) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700" title={fmtTime(log.published_at)}>Published</span>;
  if (log?.error) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700" title={log.error}>Failed</span>;
  if (date && date < today) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Missed</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Scheduled</span>;
}

export default function InstagramPage() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [check, setCheck] = useState<{ ok: boolean; account?: { id: string; username?: string }; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string>('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'published' | 'failed'>('all');
  const [open, setOpen] = useState<number | null>(null);
  const today = todayIso();

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/ig');
    if (res.ok) {
      const data = (await res.json()) as { config: Config; rows: PlanRow[] };
      setRows(data.rows);
      setConfig(data.config);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runCheck = async () => {
    setChecking(true);
    const res = await fetch('/api/admin/ig/check', { method: 'POST' });
    setCheck((await res.json()) as typeof check);
    setChecking(false);
  };

  const publish = async (row: PlanRow, kinds: Kind[]) => {
    const label = kinds.length === 2 ? 'feed + story' : kinds[0];
    if (!window.confirm(`Post "${row.file}" (${label}) to Instagram now?`)) return;
    setBusy(`${row.index}:${kinds.join('+')}`);
    setMessage('');
    const res = await fetch('/api/admin/ig/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ set: row.set, file: row.file, kinds }),
    });
    const data = (await res.json()) as { results?: Outcome[]; error?: string };
    if (!res.ok || !data.results) setMessage(data.error ?? 'Publish failed');
    else setMessage(data.results.map((r) => `${r.kind}: ${r.status}${r.error ? ` — ${r.error}` : ''}`).join(' · '));
    setBusy('');
    await load();
  };

  const reset = async (row: PlanRow) => {
    if (!window.confirm(`Forget the log for "${row.file}"? The cron will post it again on its date. Nothing is deleted on Instagram.`)) return;
    setBusy(`${row.index}:reset`);
    await fetch('/api/admin/ig/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set: row.set, file: row.file }) });
    setBusy('');
    await load();
  };

  const visible = useMemo(() => {
    return rows.filter((r) => {
      const published = Boolean(r.feed?.published_at || r.story?.published_at);
      const failed = Boolean(r.feed?.error || r.story?.error) && !published;
      if (filter === 'published') return published;
      if (filter === 'failed') return failed;
      if (filter === 'upcoming') return !published && (!r.date || r.date >= today);
      return true;
    });
  }, [rows, filter, today]);

  const stats = useMemo(() => {
    const published = rows.filter((r) => r.feed?.published_at).length;
    const failed = rows.filter((r) => (r.feed?.error || r.story?.error) && !r.feed?.published_at).length;
    const next = rows.find((r) => !r.feed?.published_at && r.date && r.date >= today);
    return { published, failed, next };
  }, [rows, today]);

  const ready = config?.credentials && config?.start;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instagram</h1>
          <p className="mt-1 text-sm text-gray-500">40 feed posts and their matching stories, posted Mon / Wed / Fri at 18:00 by the cron. Nothing here edits the plan; it shows what will go out and lets you test.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={runCheck} disabled={checking}>
            {checking ? 'Checking…' : 'Check connection'}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Connection" value={config ? (config.credentials ? 'Token set' : 'No token') : '…'} sub={config ? `${config.login} login · ${config.lang.toUpperCase()}` : ''} tone={config?.credentials ? 'ok' : 'warn'} />
        <Stat label="Plan start" value={config?.start ? fmtDate(config.start) : 'Not set'} sub={config?.start ? 'Monday of week 1' : 'Set IG_PLAN_START in Vercel'} tone={config?.start ? 'ok' : 'warn'} />
        <Stat label="Published" value={`${stats.published} / ${rows.length || 40}`} sub={stats.failed ? `${stats.failed} failed` : 'feed posts'} tone={stats.failed ? 'warn' : 'ok'} />
        <Stat label="Next up" value={stats.next ? fmtDate(stats.next.date) : '—'} sub={stats.next ? `${DAY[stats.next.day]} · set ${stats.next.set} · ${stats.next.file}` : ''} />
      </div>

      {check && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${check.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {check.ok ? (
            <>Token is valid. Posting as <b>@{check.account?.username ?? check.account?.id}</b>.</>
          ) : (
            <>Connection failed: {check.error}</>
          )}
        </div>
      )}
      {!ready && config && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add <code>META_IG_USER_ID</code>, <code>META_IG_ACCESS_TOKEN</code> and <code>IG_PLAN_START</code> to the admin project in Vercel and redeploy. Until then the cron does nothing and “Post now” is disabled.
        </div>
      )}
      {message && <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{message}</div>}

      <div className="mb-3 flex items-center gap-3">
        <span className={SECTION_TITLE}>Plan</span>
        <select className={SELECT} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All 40</option>
          <option value="upcoming">Upcoming</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-gray-400">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-2 py-2">Post</th>
                <th className="px-2 py-2">Feed</th>
                <th className="px-2 py-2">Story</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => {
                const isOpen = open === r.index;
                const feedDone = Boolean(r.feed?.published_at);
                const storyDone = Boolean(r.story?.published_at);
                return (
                  <tr key={r.index} className={r.date === today ? 'bg-brand-50/40' : ''}>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-gray-900">{fmtDate(r.date)}</div>
                      <div className="text-xs text-gray-500">Week {r.week} · {DAY[r.day]}</div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <button type="button" className="flex items-start gap-3 text-left" onClick={() => setOpen(isOpen ? null : r.index)}>
                        <img src={r.sq} alt="" className="h-16 w-16 flex-none rounded-md object-cover" loading="lazy" />
                        <div>
                          <div className="font-mono text-xs text-brand-600">set{r.set} · {r.file}</div>
                          <div className="mt-0.5 line-clamp-2 text-gray-700">{r.sr}</div>
                          <div className="mt-0.5 text-xs capitalize text-gray-400">{r.vertical}</div>
                          {isOpen && (
                            <div className="mt-3 space-y-2 text-xs text-gray-600">
                              <div><b className="text-gray-500">EN</b> {r.en}</div>
                              <div className="flex gap-3">
                                <a href={r.sq} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open square</a>
                                <a href={r.st} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open story</a>
                              </div>
                              {(r.feed?.error || r.story?.error) && (
                                <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{r.feed?.error ?? r.story?.error}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-2 py-3 align-top"><StatePill log={r.feed} today={today} date={r.date} /></td>
                    <td className="px-2 py-3 align-top"><StatePill log={r.story} today={today} date={r.date} /></td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        {!(feedDone && storyDone) && (
                          <button type="button" className={BTN_PRIMARY} disabled={!ready || Boolean(busy)} onClick={() => publish(r, ['feed', 'story'])}>
                            {busy === `${r.index}:feed+story` ? 'Posting…' : 'Post now'}
                          </button>
                        )}
                        {!feedDone && (
                          <button type="button" className={BTN_SECONDARY} disabled={!ready || Boolean(busy)} onClick={() => publish(r, ['feed'])}>
                            {busy === `${r.index}:feed` ? '…' : 'Feed only'}
                          </button>
                        )}
                        {!storyDone && feedDone && (
                          <button type="button" className={BTN_SECONDARY} disabled={!ready || Boolean(busy)} onClick={() => publish(r, ['story'])}>
                            {busy === `${r.index}:story` ? '…' : 'Story only'}
                          </button>
                        )}
                        {(r.feed || r.story) && (
                          <button type="button" className={BTN_DANGER} disabled={Boolean(busy)} onClick={() => reset(r)} title="Forget the log so this row can be posted again">
                            {busy === `${r.index}:reset` ? '…' : 'Reset'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-gray-400">
        Stories go out without the link sticker (the API cannot add one). Add it by hand in the Instagram app after a story posts if you want the tap. Captions: Serbian, divider, English, CTA, hashtags.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone === 'warn' ? 'text-amber-600' : 'text-brand-600'}`}>{value}</div>
      {sub && <div className="truncate text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
