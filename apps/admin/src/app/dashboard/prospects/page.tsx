'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { GrowthProspect, GrowthProspectStage } from '@balkina/shared';
import { GROWTH_PROSPECT_STAGES } from '@balkina/shared';
import { GenerateProspectsModal } from '@/components/generate-prospects-modal';
import { ProspectCard, ProspectRow, STAGE_LABELS } from '@/components/prospect-row';

interface Facets {
  total: number;
  stages: Record<string, number>;
  countries: Record<string, number>;
  cities: Record<string, Record<string, number>>;
  verticals: Record<string, number>;
  totals: { withEmail: number; enriched: number; pagesBuilt: number; claimed: number; contacted: number; highScore: number; viewed: number; tested: number; due: number };
}

// 'due' is the follow-up queue (next_follow_up_at ≤ end of today), not a stage.
const STAGE_TABS: (GrowthProspectStage | 'all' | 'due')[] = ['all', 'due', 'new', 'enriched', 'preprovisioned', 'contacted', 'viewed', 'engaged', 'replied', 'claimed', 'signed_up', 'customer', 'lost'];

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export default function ProspectsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}>
      <Prospects />
    </Suspense>
  );
}

function Prospects() {
  const params = useSearchParams();
  const [rows, setRows] = useState<GrowthProspect[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowBusy, setRowBusy] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);

  const [stage, setStage] = useState(params.get('stage') ?? 'all');
  const [country, setCountry] = useState(params.get('country') ?? 'all');
  const [city, setCity] = useState(params.get('city') ?? 'all');
  const [vertical, setVertical] = useState(params.get('vertical') ?? 'all');
  const [minScore, setMinScore] = useState(params.get('min_score') ?? '');
  const [hasEmail, setHasEmail] = useState('any');
  const [built, setBuilt] = useState('any');
  const [activity, setActivity] = useState('any');
  const [sort, setSort] = useState('score');
  const [q, setQ] = useState('');

  const loadFacets = useCallback(async () => {
    const res = await fetch('/api/admin/growth/prospects/facets');
    if (res.ok) setFacets(await res.json());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams({ stage: stage === 'due' ? 'all' : stage, country, vertical, page: String(page), sort: stage === 'due' ? 'due' : sort });
    if (stage === 'due') sp.set('due_before', endOfTodayIso());
    if (city !== 'all') sp.set('city', city);
    if (minScore) sp.set('min_score', minScore);
    if (hasEmail !== 'any') sp.set('has_email', hasEmail);
    if (built !== 'any') sp.set('built', built);
    if (activity !== 'any') sp.set('activity', activity);
    if (q) sp.set('q', q);
    const res = await fetch(`/api/admin/growth/prospects?${sp}`);
    const json = await res.json();
    setRows(json.data ?? []);
    setCount(json.count ?? 0);
    setPageSize(json.page_size ?? 50);
    setLoading(false);
  }, [stage, country, city, vertical, minScore, hasEmail, built, activity, sort, q, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadFacets(); }, [loadFacets]);

  const refresh = () => { load(); loadFacets(); };

  const update = async (id: string, patch: Partial<Pick<GrowthProspect, 'stage' | 'notes' | 'email' | 'instagram'>>) => {
    const res = await fetch('/api/admin/growth/prospects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) { setMessage(`Error: ${(await res.json()).error}`); return; }
    setRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...patch } as GrowthProspect) : r)));
    if (patch.stage) loadFacets();
  };

  // The activity log changes stage/counters server-side (trigger); swap the row in place.
  const replaceRow = (row: GrowthProspect) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
    loadFacets();
  };
  const showError = (msg: string) => setMessage(`Error: ${msg}`);

  const remove = async (row: GrowthProspect) => {
    if (!confirm(`Delete "${row.name}" from prospects?`)) return;
    const res = await fetch(`/api/admin/growth/prospects?id=${row.id}`, { method: 'DELETE' });
    if (res.ok) refresh();
  };

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Request failed');
    return json;
  };

  const enrich = async (ids: string[]) => {
    setMessage('');
    const busy: Record<string, string> = {};
    ids.forEach((id) => { busy[id] = 'enrich'; });
    setRowBusy((b) => ({ ...b, ...busy }));
    try {
      let enriched = 0, skipped = 0, emails = 0;
      for (let i = 0; i < ids.length; i += 16) {
        const json = await post('/api/admin/growth/enricher', { prospect_ids: ids.slice(i, i + 16) });
        enriched += json.enriched ?? 0; skipped += json.skipped ?? 0; emails += json.emails_found ?? 0;
        if (json.errors?.length && ids.length === 1) setMessage(`Error: ${json.errors[0].message}`);
      }
      if (ids.length > 1) setMessage(`Enriched ${enriched}, skipped ${skipped} (Instagram-only or no website), ${emails} emails found.`);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'enrichment failed'}`);
    }
    setRowBusy((b) => { const n = { ...b }; ids.forEach((id) => delete n[id]); return n; });
    refresh();
  };

  const build = async (ids: string[]) => {
    setMessage('');
    const busy: Record<string, string> = {};
    ids.forEach((id) => { busy[id] = 'build'; });
    setRowBusy((b) => ({ ...b, ...busy }));
    try {
      let created = 0, existing = 0;
      const errors: string[] = [];
      for (let i = 0; i < ids.length; i += 25) {
        const json = await post('/api/admin/growth/preprovision', { prospect_ids: ids.slice(i, i + 25) });
        created += json.created ?? 0; existing += json.existing ?? 0;
        for (const e of json.errors ?? []) errors.push(`${e.prospect}: ${e.message}`);
      }
      setMessage(errors.length ? `Error: ${errors[0]}` : `Built ${created} booking page${created === 1 ? '' : 's'}${existing ? ` (${existing} already existed)` : ''}. Copy the claim links from each row.`);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'build failed'}`);
    }
    setRowBusy((b) => { const n = { ...b }; ids.forEach((id) => delete n[id]); return n; });
    refresh();
  };

  const bulkStage = async (s: GrowthProspectStage) => {
    setBulkBusy('stage');
    await Promise.all(Array.from(selected).map((id) => update(id, { stage: s })));
    setBulkBusy('');
    setSelected(new Set());
    refresh();
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} prospects?`)) return;
    setBulkBusy('delete');
    await Promise.all(Array.from(selected).map((id) => fetch(`/api/admin/growth/prospects?id=${id}`, { method: 'DELETE' })));
    setBulkBusy('');
    setSelected(new Set());
    refresh();
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const t = facets?.totals;
  const cityOptions = facets ? Object.entries(country === 'all' ? mergeCities(facets.cities) : facets.cities[country] ?? {}).sort((a, b) => b[1] - a[1]) : [];
  const verticalOptions = facets ? Object.entries(facets.verticals).sort((a, b) => b[1] - a[1]) : [];
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const isEmpty = facets !== null && facets.total === 0;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="mt-1 text-sm text-gray-500">Businesses we found, what we know about them, and where each one is in the funnel.</p>
        </div>
        <button onClick={() => setShowGenerate(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Generate prospects
        </button>
      </div>

      {showGenerate && <GenerateProspectsModal onClose={() => setShowGenerate(false)} onFinished={refresh} />}

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message} <button onClick={() => setMessage('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {isEmpty ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center md:mt-10 md:px-8 md:py-16">
          <h2 className="text-lg font-semibold text-gray-900">No prospects yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            Choose countries, cities and business types. Balkina searches Google Places, scores every business against the ideal customer profile, and visits their websites for emails, services and prices. Then you build their booking pages and start outreach.
          </p>
          <button onClick={() => setShowGenerate(true)} className="mt-6 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
            Generate prospects
          </button>
        </div>
      ) : (
        <>
          {/* Funnel strip */}
          {t && (
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 lg:grid-cols-6">
              <Kpi label="Prospects" value={facets?.total ?? 0} sub={`${t.highScore} high fit · ${t.enriched} enriched`} />
              <Kpi label="Pages built" value={t.pagesBuilt} />
              <Kpi label="Contacted" value={t.contacted} sub={pct(t.contacted, t.pagesBuilt, 'of pages')} />
              <Kpi label="Viewed page" value={t.viewed} sub={pct(t.viewed, t.contacted, 'of contacted')} />
              <Kpi label="Tested booking" value={t.tested} sub={pct(t.tested, t.viewed, 'of viewers')} />
              <Kpi label="Claimed" value={t.claimed} sub={pct(t.claimed, t.contacted, 'of contacted')} />
            </div>
          )}

          {/* Stage tabs */}
          <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {STAGE_TABS.map((s) => {
              const n = s === 'all' ? facets?.total ?? 0 : s === 'due' ? facets?.totals.due ?? 0 : facets?.stages[s] ?? 0;
              if (s !== 'all' && s !== 'due' && n === 0 && stage !== s) return null;
              const on = stage === s;
              const dueCls = n > 0 ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200';
              return (
                <button
                  key={s}
                  onClick={() => { setStage(s); setPage(1); setSelected(new Set()); }}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${on ? 'bg-gray-900 text-white' : s === 'due' ? dueCls : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {s === 'all' ? 'All' : s === 'due' ? '⏰ Due today' : STAGE_LABELS[s]} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <select value={country} onChange={(e) => { setCountry(e.target.value); setCity('all'); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="all">All countries</option>
              {Object.entries(facets?.countries ?? {}).sort((a, b) => b[1] - a[1]).map(([c, n]) => <option key={c} value={c}>{c.toUpperCase()} ({n})</option>)}
            </select>
            <select value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="all">All cities</option>
              {cityOptions.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
            </select>
            <select value={vertical} onChange={(e) => { setVertical(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="all">All business types</option>
              {verticalOptions.map(([v, n]) => <option key={v} value={v}>{v.replace(/_/g, ' ')} ({n})</option>)}
            </select>
            <select value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="">Any quality</option>
              <option value="2">Score 2+</option>
              <option value="4">Score 4+ (high fit)</option>
              <option value="6">Score 6+</option>
            </select>
            <select value={hasEmail} onChange={(e) => { setHasEmail(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="any">Email: any</option>
              <option value="yes">Has email</option>
              <option value="no">No email</option>
            </select>
            <select value={built} onChange={(e) => { setBuilt(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="any">Page: any</option>
              <option value="yes">Page built</option>
              <option value="no">No page yet</option>
            </select>
            <select value={activity} onChange={(e) => { setActivity(e.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="any">Activity: any</option>
              <option value="untouched">Not contacted yet</option>
              <option value="viewed">Viewed the page</option>
              <option value="tested">Tested a booking</option>
            </select>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name / site / IG" className="col-span-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm sm:w-52" />
            <span className="col-span-2 flex items-center gap-1 text-xs text-gray-400 sm:ml-auto">
              {count} matching · sorted by
              {stage === 'due' ? (
                <span>follow-up due</span>
              ) : (
                <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="rounded border-0 bg-transparent p-0 text-xs text-gray-600 underline">
                  <option value="score">score</option>
                  <option value="activity">last activity</option>
                  <option value="due">follow-up due</option>
                </select>
              )}
            </span>
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm">
              <span className="font-medium text-brand-900">{selected.size} selected</span>
              <button onClick={() => enrich(Array.from(selected))} className="rounded-md bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50">Enrich</button>
              <button onClick={() => build(Array.from(selected))} className="rounded-md bg-white px-3 py-1 text-xs font-medium text-violet-700 shadow-sm hover:bg-gray-50">Build booking pages</button>
              <select
                defaultValue=""
                onChange={(e) => { if (e.target.value) bulkStage(e.target.value as GrowthProspectStage); e.target.value = ''; }}
                disabled={bulkBusy !== ''}
                className="rounded-md border-0 bg-white px-2 py-1 text-xs shadow-sm"
              >
                <option value="">Set stage…</option>
                {GROWTH_PROSPECT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <button onClick={bulkDelete} disabled={bulkBusy !== ''} className="rounded-md bg-white px-3 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-gray-50">Delete</button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:underline">clear</button>
            </div>
          )}

          {loading ? (
            <p className="text-gray-400">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">No prospects match these filters.</div>
          ) : (
            <>
            {/* Mobile: cards */}
            <div className="space-y-2 md:hidden">
              <label className="flex items-center gap-2 px-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set([...Array.from(selected), ...rows.map((r) => r.id)]) : new Set(Array.from(selected).filter((id) => !rows.some((r) => r.id === id))))}
                />
                Select all on this page
              </label>
              {rows.map((r) => (
                <ProspectCard
                  key={r.id}
                  row={r}
                  selected={selected.has(r.id)}
                  expanded={expanded === r.id}
                  busy={rowBusy[r.id] ?? null}
                  onSelect={(on) => setSelected((prev) => { const n = new Set(prev); if (on) n.add(r.id); else n.delete(r.id); return n; })}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  onUpdate={(patch) => update(r.id, patch)}
                  onRowChange={replaceRow}
                  onError={showError}
                  onEnrich={() => enrich([r.id])}
                  onBuild={() => build([r.id])}
                  onDelete={() => remove(r)}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-8 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={(e) => setSelected(e.target.checked ? new Set([...Array.from(selected), ...rows.map((r) => r.id)]) : new Set(Array.from(selected).filter((id) => !rows.some((r) => r.id === id))))}
                      />
                    </th>
                    <th className="px-3 py-3">Score</th>
                    <th className="px-3 py-3">Business</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">City</th>
                    <th className="px-3 py-3">Google</th>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Stage</th>
                    <th className="px-3 py-3">Activity</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <ProspectRow
                      key={r.id}
                      row={r}
                      selected={selected.has(r.id)}
                      expanded={expanded === r.id}
                      busy={rowBusy[r.id] ?? null}
                      onSelect={(on) => setSelected((prev) => { const n = new Set(prev); if (on) n.add(r.id); else n.delete(r.id); return n; })}
                      onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                      onUpdate={(patch) => update(r.id, patch)}
                      onRowChange={replaceRow}
                      onError={showError}
                      onEnrich={() => enrich([r.id])}
                      onBuild={() => build([r.id])}
                      onDelete={() => remove(r)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function mergeCities(byCountry: Record<string, Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cities of Object.values(byCountry)) {
    for (const [city, n] of Object.entries(cities)) out[city] = (out[city] ?? 0) + n;
  }
  return out;
}

function pct(n: number, of: number, label: string): string | undefined {
  if (!of) return undefined;
  return `${Math.round((n / of) * 100)}% ${label}`;
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}
