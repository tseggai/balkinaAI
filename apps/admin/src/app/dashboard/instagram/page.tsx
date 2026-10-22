'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CanvaCard } from '@/components/canva-card';
import { ConfirmDialog, type ConfirmRequest } from '@/components/confirm-dialog';
import { IgRowModal, type RowEdit, type RowEditResult } from '@/components/ig-row-modal';
import { IgSettingsCard, type IgSettingsValue } from '@/components/ig-settings-card';
import { Modal } from '@/components/modal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT, SECTION_TITLE, SELECT } from '@/components/prospect-crm';

type Kind = 'feed' | 'story';

interface LogRow {
  key: string;
  kind: Kind;
  ig_media_id: string | null;
  published_at: string | null;
  error: string | null;
  attempts: number;
}

interface PlanRow {
  index: number;
  key: string;
  set: number;
  file: string;
  vertical: string;
  sr: string;
  en: string;
  sq: string;
  st: string;
  scheduledAt: string | null;
  source: 'plan' | 'override';
  enabled: boolean;
  kinds: Kind[];
  feed: LogRow | null;
  story: LogRow | null;
}

interface Config {
  base: string;
  lang: string;
  credentials: boolean;
  login: 'instagram' | 'facebook';
}

interface Outcome {
  key: string;
  kind: Kind;
  status: 'published' | 'skipped' | 'failed';
  error?: string;
}

type Filter = 'all' | 'upcoming' | 'published' | 'failed' | 'skipped';

function fmtWhen(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '—', time: '' };
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatePill({ log, wanted, enabled, scheduledAt, now }: { log: LogRow | null; wanted: boolean; enabled: boolean; scheduledAt: string | null; now: number }) {
  if (log?.published_at) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700" title={fmtTime(log.published_at)}>Published</span>;
  if (log?.error) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700" title={log.error}>Failed{log.attempts > 1 ? ` ×${log.attempts}` : ''}</span>;
  if (!enabled || !wanted) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-400">Skipped</span>;
  if (scheduledAt && Date.parse(scheduledAt) < now - 36 * 3600 * 1000) return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Missed</span>;
  if (scheduledAt && Date.parse(scheduledAt) < now) return <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">Due</span>;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Scheduled</span>;
}

export default function InstagramPage() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [settings, setSettings] = useState<IgSettingsValue | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [check, setCheck] = useState<{ ok: boolean; account?: { id: string; user_id?: string; username?: string }; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ title: string; lines: string[] } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [editing, setEditing] = useState<RowEdit | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTime, setBulkTime] = useState('18:00');
  const [bulkShift, setBulkShift] = useState('7');
  const now = Date.now();

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/ig');
    if (res.ok) {
      const data = (await res.json()) as { config: Config; settings: IgSettingsValue; rows: PlanRow[] };
      setRows(data.rows);
      setSettings(data.settings);
      setConfig(data.config);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const notify = useCallback((title: string, lines: string[]) => setNotice({ title, lines }), []);

  const api = async (path: string, body: unknown, method = 'POST'): Promise<{ ok: boolean; data: Record<string, unknown> }> => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  };

  const runCheck = async () => {
    setChecking(true);
    const res = await fetch('/api/admin/ig/check', { method: 'POST' });
    setCheck((await res.json()) as typeof check);
    setChecking(false);
  };

  const saveSettings = async (next: IgSettingsValue) => {
    const { ok, data } = await api('/api/admin/ig/settings', next, 'PUT');
    setNotice(ok ? { title: 'Schedule saved', lines: ['Rows without a custom time now follow the new cadence.'] } : { title: 'Could not save', lines: [String(data.error ?? 'Unknown error')] });
    await load();
  };

  const publish = (row: PlanRow, kinds: Kind[]) => {
    const label = kinds.length === 2 ? 'feed + story' : kinds[0];
    setConfirm({
      title: 'Post to Instagram now?',
      body: `${row.file} · ${label}. This publishes immediately to @balkina.ai.`,
      confirmLabel: 'Post now',
      onConfirm: async () => {
        setBusy(true);
        const { ok, data } = await api('/api/admin/ig/publish', { set: row.set, file: row.file, kinds });
        const results = (data.results as Outcome[] | undefined) ?? [];
        setBusy(false);
        setConfirm(null);
        setNotice(
          ok && results.length
            ? { title: results.some((r) => r.status === 'failed') ? 'Posted with errors' : 'Posted', lines: results.map((r) => `${r.kind}: ${r.status}${r.error ? ` — ${r.error}` : ''}`) }
            : { title: 'Publish failed', lines: [String(data.error ?? 'Unknown error')] }
        );
        await load();
      },
    });
  };

  const reset = (row: PlanRow) => {
    setConfirm({
      title: 'Forget the publish log?',
      body: `${row.file} will count as not posted and go out again at its scheduled time. Nothing is deleted on Instagram.`,
      confirmLabel: 'Reset',
      danger: true,
      onConfirm: async () => {
        setBusy(true);
        await api('/api/admin/ig/reset', { set: row.set, file: row.file });
        setBusy(false);
        setConfirm(null);
        await load();
      },
    });
  };

  const saveRow = async (key: string, next: RowEditResult) => {
    setBusy(true);
    const { ok, data } = await api('/api/admin/ig/overrides', { keys: [key], set: next });
    setBusy(false);
    if (!ok) setNotice({ title: 'Could not save', lines: [String(data.error ?? 'Unknown error')] });
    setEditing(null);
    await load();
  };

  const clearRow = async (key: string) => {
    setBusy(true);
    await api('/api/admin/ig/overrides', { keys: [key], clear: true });
    setBusy(false);
    setEditing(null);
    await load();
  };

  const bulk = async (body: Record<string, unknown>, what: string) => {
    const keys = Array.from(selected);
    if (keys.length === 0) return;
    setBusy(true);
    const { ok, data } = await api('/api/admin/ig/overrides', { keys, ...body });
    setBusy(false);
    setNotice(ok ? { title: 'Updated', lines: [`${what} for ${keys.length} post${keys.length === 1 ? '' : 's'}.`] } : { title: 'Could not update', lines: [String(data.error ?? 'Unknown error')] });
    await load();
  };

  const visible = useMemo(() => {
    return rows.filter((r) => {
      const published = Boolean(r.feed?.published_at || r.story?.published_at);
      const failed = Boolean(r.feed?.error || r.story?.error) && !published;
      if (filter === 'published') return published;
      if (filter === 'failed') return failed;
      if (filter === 'skipped') return !r.enabled;
      if (filter === 'upcoming') return !published && r.enabled && (!r.scheduledAt || Date.parse(r.scheduledAt) >= now - 36 * 3600 * 1000);
      return true;
    });
  }, [rows, filter, now]);

  const stats = useMemo(() => {
    const published = rows.filter((r) => r.feed?.published_at).length;
    const failed = rows.filter((r) => (r.feed?.error || r.story?.error) && !r.feed?.published_at).length;
    const next = rows.filter((r) => r.enabled && !r.feed?.published_at && r.scheduledAt && Date.parse(r.scheduledAt) >= now).sort((a, b) => Date.parse(a.scheduledAt ?? '') - Date.parse(b.scheduledAt ?? ''))[0];
    return { published, failed, next };
  }, [rows, now]);

  const ready = Boolean(config?.credentials) && Boolean(settings?.start_date);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.key));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.key)));
  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instagram</h1>
          <p className="mt-1 text-sm text-gray-500">40 feed posts and their matching stories. The publisher checks every 15 minutes and posts whatever is due.</p>
        </div>
        <button type="button" className={BTN_SECONDARY} onClick={runCheck} disabled={checking}>{checking ? 'Checking…' : 'Check connection'}</button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Connection" value={config ? (config.credentials ? 'Token set' : 'No token') : '…'} sub={config ? `${config.login} login · ${config.lang.toUpperCase()}` : ''} tone={config?.credentials ? 'ok' : 'warn'} />
        <Stat label="Status" value={settings?.paused ? 'Paused' : settings?.start_date ? 'Running' : 'No start date'} sub={settings ? `${settings.days.length}× a week at ${settings.post_time}` : ''} tone={settings?.paused || !settings?.start_date ? 'warn' : 'ok'} />
        <Stat label="Published" value={`${stats.published} / ${rows.length || 40}`} sub={stats.failed ? `${stats.failed} failed` : 'feed posts'} tone={stats.failed ? 'warn' : 'ok'} />
        <Stat label="Next up" value={stats.next ? fmtWhen(stats.next.scheduledAt).date : '—'} sub={stats.next ? `${fmtWhen(stats.next.scheduledAt).time} · ${stats.next.file}` : ''} />
      </div>

      {check && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${check.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {check.ok ? <>Token is valid. Posting as <b>@{check.account?.username ?? check.account?.id}</b>{check.account?.user_id ? <> (account id {check.account.user_id})</> : null}.</> : <>Connection failed: {check.error}</>}
        </div>
      )}
      {config && !config.credentials && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add <code>META_IG_ACCESS_TOKEN</code> to the admin project in Vercel and redeploy. Until then nothing can be published.
        </div>
      )}

      {settings && <div className="mb-4"><IgSettingsCard value={settings} onSave={saveSettings} /></div>}
      <div className="mb-6"><CanvaCard notify={notify} /></div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={SECTION_TITLE}>Plan</span>
        <select className={SELECT} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All 40</option>
          <option value="upcoming">Upcoming</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
            <span className="font-semibold text-brand-700">{selected.size} selected</span>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1">
              <input type="number" className={`${INPUT} w-20 py-1`} value={bulkShift} onChange={(e) => setBulkShift(e.target.value)} />
              <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => bulk({ shift_days: Number(bulkShift) }, `Shifted by ${bulkShift} day(s)`)}>Shift days</button>
            </div>
            <div className="flex items-center gap-1">
              <input type="time" className={`${INPUT} w-28 py-1`} value={bulkTime} onChange={(e) => setBulkTime(e.target.value)} />
              <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => bulk({ time: bulkTime }, `Time set to ${bulkTime}`)}>Set time</button>
            </div>
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => bulk({ set: { enabled: false } }, 'Skipped')}>Skip</button>
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => bulk({ set: { enabled: true } }, 'Re-enabled')}>Enable</button>
            <select className={SELECT} disabled={busy} defaultValue="" onChange={(e) => { if (e.target.value) void bulk({ set: { kinds: e.target.value.split('+') } }, `Kinds set to ${e.target.value}`); e.target.value = ''; }}>
              <option value="">Post…</option>
              <option value="feed+story">Feed + story</option>
              <option value="feed">Feed only</option>
              <option value="story">Story only</option>
            </select>
            <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={() => bulk({ clear: true }, 'Back to plan cadence')}>Back to plan</button>
            <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setSelected(new Set())}>Clear selection</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-gray-400">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300 text-brand-600" /></th>
                <th className="px-2 py-2">When</th>
                <th className="px-2 py-2">Post</th>
                <th className="px-2 py-2">Feed</th>
                <th className="px-2 py-2">Story</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => {
                const isOpen = open === r.key;
                const feedDone = Boolean(r.feed?.published_at);
                const storyDone = Boolean(r.story?.published_at);
                const when = fmtWhen(r.scheduledAt);
                const isNext = stats.next?.key === r.key;
                return (
                  <tr key={r.key} className={`${isNext ? 'bg-brand-50/40' : ''} ${!r.enabled ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-3 align-top"><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} className="h-4 w-4 rounded border-gray-300 text-brand-600" /></td>
                    <td className="px-2 py-3 align-top">
                      <button
                        type="button"
                        className="text-left"
                        title="Edit schedule"
                        onClick={() => setEditing({ key: r.key, label: r.file, scheduledAt: r.scheduledAt, source: r.source, enabled: r.enabled, kinds: r.kinds })}
                      >
                        <div className="font-medium text-gray-900 hover:text-brand-600">{when.date}</div>
                        <div className="text-xs text-gray-500">{when.time}{r.source === 'override' && <span className="ml-1 rounded bg-brand-100 px-1 text-[10px] font-semibold text-brand-700">custom</span>}</div>
                      </button>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <button type="button" className="flex items-start gap-3 text-left" onClick={() => setOpen(isOpen ? null : r.key)}>
                        <img src={r.sq} alt="" className="h-16 w-16 flex-none rounded-md object-cover" loading="lazy" />
                        <div>
                          <div className="font-mono text-xs text-brand-600">set{r.set} · {r.file}</div>
                          <div className="mt-0.5 line-clamp-2 text-gray-700">{r.sr}</div>
                          <div className="mt-0.5 text-xs capitalize text-gray-400">{r.vertical}{r.kinds.length === 1 ? ` · ${r.kinds[0]} only` : ''}</div>
                          {isOpen && (
                            <div className="mt-3 space-y-2 text-xs text-gray-600">
                              <div><b className="text-gray-500">EN</b> {r.en}</div>
                              <div className="flex gap-3">
                                <a href={r.sq} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open square</a>
                                <a href={r.st} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Open story</a>
                              </div>
                              {(r.feed?.error || r.story?.error) && <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{r.feed?.error ?? r.story?.error}</div>}
                            </div>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-2 py-3 align-top"><StatePill log={r.feed} wanted={r.kinds.includes('feed')} enabled={r.enabled} scheduledAt={r.scheduledAt} now={now} /></td>
                    <td className="px-2 py-3 align-top"><StatePill log={r.story} wanted={r.kinds.includes('story')} enabled={r.enabled} scheduledAt={r.scheduledAt} now={now} /></td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        {!(feedDone && storyDone) && (
                          <button type="button" className={BTN_PRIMARY} disabled={!config?.credentials || busy} onClick={() => publish(r, ['feed', 'story'])}>Post now</button>
                        )}
                        {!feedDone && <button type="button" className={BTN_SECONDARY} disabled={!config?.credentials || busy} onClick={() => publish(r, ['feed'])}>Feed only</button>}
                        {!storyDone && feedDone && <button type="button" className={BTN_SECONDARY} disabled={!config?.credentials || busy} onClick={() => publish(r, ['story'])}>Story only</button>}
                        {(r.feed || r.story) && <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => reset(r)}>Reset</button>}
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
        Click a date to set a custom time, skip a post, or post only the feed or story. Select rows for bulk changes. Times shown in your browser&apos;s timezone{settings ? `; the plan runs in ${settings.timezone}` : ''}. Stories go out without the link sticker (the API cannot add one). {ready ? '' : 'Set a first posting day to start the schedule.'}
      </p>

      <ConfirmDialog request={confirm} busy={busy} onClose={() => (busy ? undefined : setConfirm(null))} />
      <IgRowModal row={editing} busy={busy} onClose={() => (busy ? undefined : setEditing(null))} onSave={saveRow} onClear={clearRow} />
      <Modal open={Boolean(notice)} onClose={() => setNotice(null)} title={notice?.title ?? ''} footer={<button type="button" className={BTN_PRIMARY} onClick={() => setNotice(null)}>OK</button>}>
        <ul className="space-y-1">{notice?.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </Modal>
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
