'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { GrowthProspect, GrowthProspectStage } from '@balkina/shared';
import { GROWTH_PROSPECT_STAGES } from '@balkina/shared';

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  enriched: 'bg-sky-100 text-sky-800',
  qualified: 'bg-indigo-100 text-indigo-800',
  disqualified: 'bg-gray-100 text-gray-400',
  preprovisioned: 'bg-violet-100 text-violet-800',
  contacted: 'bg-blue-100 text-blue-800',
  replied: 'bg-amber-100 text-amber-800',
  claimed: 'bg-emerald-100 text-emerald-800',
  signed_up: 'bg-green-100 text-green-800',
  customer: 'bg-green-200 text-green-900',
  lost: 'bg-red-100 text-red-700',
};

const COUNTRIES = ['all', 'rs', 'me', 'hr'];

export default function ProspectsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}>
      <ProspectsTable />
    </Suspense>
  );
}

function ProspectsTable() {
  const params = useSearchParams();
  const [rows, setRows] = useState<GrowthProspect[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [segment, setSegment] = useState(params.get('segment') ?? 'all');
  const [stage, setStage] = useState(params.get('stage') ?? 'all');
  const [vertical, setVertical] = useState(params.get('vertical') ?? 'all');
  const [country, setCountry] = useState(params.get('country') ?? 'all');
  const [city, setCity] = useState(params.get('city') ?? '');
  const [minScore, setMinScore] = useState(params.get('min_score') ?? '');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams({ segment, stage, vertical, country, page: String(page) });
    if (city) sp.set('city', city);
    if (minScore) sp.set('min_score', minScore);
    if (q) sp.set('q', q);
    const res = await fetch(`/api/admin/growth/prospects?${sp}`);
    const json = await res.json();
    setRows(json.data ?? []);
    setCount(json.count ?? 0);
    setPageSize(json.page_size ?? 50);
    setLoading(false);
  }, [segment, stage, vertical, country, city, minScore, q, page]);

  useEffect(() => { load(); }, [load]);

  const update = async (id: string, patch: Partial<Pick<GrowthProspect, 'stage' | 'notes' | 'email' | 'instagram'>>) => {
    const res = await fetch('/api/admin/growth/prospects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) {
      const j = await res.json();
      setMessage(`Error: ${j.error}`);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as GrowthProspect : r)));
  };

  const remove = async (row: GrowthProspect) => {
    if (!confirm(`Delete "${row.name}" from prospects?`)) return;
    const res = await fetch(`/api/admin/growth/prospects?id=${row.id}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  const verticals = Array.from(new Set(rows.map((r) => r.vertical).filter(Boolean))) as string[];
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="mt-1 text-sm text-gray-500">{count} matching · sorted by ICP score</p>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {message} <button onClick={() => setMessage('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={segment} onChange={(v) => { setSegment(v); setPage(1); }} options={['all', 'tenant', 'property']} />
        <Select value={stage} onChange={(v) => { setStage(v); setPage(1); }} options={['all', ...GROWTH_PROSPECT_STAGES]} />
        <Select value={country} onChange={(v) => { setCountry(v); setPage(1); }} options={COUNTRIES} upper />
        <Select value={vertical} onChange={(v) => { setVertical(v); setPage(1); }} options={['all', ...(vertical !== 'all' && !verticals.includes(vertical) ? [vertical] : []), ...verticals]} />
        <input value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} placeholder="City" className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
        <input value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }} placeholder="Min score" type="number" className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name / site / IG" className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No prospects match. Run the prospector from the Growth overview.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Vertical</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Google</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <ProspectRow
                  key={r.id}
                  row={r}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  onUpdate={(patch) => update(r.id, patch)}
                  onDelete={() => remove(r)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Prev</button>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

function ProspectRow({
  row, expanded, onToggle, onUpdate, onDelete,
}: {
  row: GrowthProspect;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Pick<GrowthProspect, 'stage' | 'notes' | 'email' | 'instagram'>>) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(row.notes ?? '');
  const [email, setEmail] = useState(row.email ?? '');
  const [instagram, setInstagram] = useState(row.instagram ?? '');

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${row.icp_score >= 4 ? 'bg-green-100 text-green-800' : row.icp_score >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
            {row.icp_score}
          </span>
        </td>
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-left font-medium text-gray-900 hover:text-brand-700">{row.name}</button>
          <div className="truncate text-xs text-gray-400" style={{ maxWidth: 260 }}>{row.address}</div>
        </td>
        <td className="px-4 py-3 text-gray-600">{row.vertical?.replace(/_/g, ' ')}</td>
        <td className="px-4 py-3 text-gray-600">{row.city} <span className="text-gray-400">{row.country?.toUpperCase()}</span></td>
        <td className="px-4 py-3 text-gray-600">
          {row.google_rating != null ? `${row.google_rating}★ (${row.google_review_count ?? 0})` : '—'}
          {row.google_maps_url && <a href={row.google_maps_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-brand-600 hover:underline">map</a>}
        </td>
        <td className="px-4 py-3 text-xs text-gray-600">
          {row.website && <a href={row.website} target="_blank" rel="noreferrer" className="block truncate text-brand-600 hover:underline" style={{ maxWidth: 180 }}>{row.website.replace(/^https?:\/\/(www\.)?/, '')}</a>}
          {row.instagram && <a href={`https://instagram.com/${row.instagram}`} target="_blank" rel="noreferrer" className="block text-pink-600 hover:underline">@{row.instagram}</a>}
          {row.phone && <span className="block">{row.phone}</span>}
          {row.email && <span className="block">{row.email}</span>}
        </td>
        <td className="px-4 py-3">
          <select
            value={row.stage}
            onChange={(e) => onUpdate({ stage: e.target.value as GrowthProspectStage })}
            className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${STAGE_COLORS[row.stage] ?? ''}`}
          >
            {GROWTH_PROSPECT_STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </td>
        <td className="px-4 py-3 text-right">
          <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-600">delete</button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs text-gray-500">
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => onUpdate({ email: email || null })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
              </label>
              <label className="text-xs text-gray-500">
                Instagram handle
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)} onBlur={() => onUpdate({ instagram: instagram || null })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
              </label>
              <div className="text-xs text-gray-500">
                Types
                <div className="mt-1 text-gray-700">{(row.google_types ?? []).slice(0, 6).join(', ') || '—'}</div>
                <div className="mt-1 text-gray-400">Status: {row.business_status ?? '—'} · Added {new Date(row.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <label className="mt-3 block text-xs text-gray-500">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onUpdate({ notes: notes || null })} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
            </label>
          </td>
        </tr>
      )}
    </>
  );
}

function Select({ value, onChange, options, upper }: { value: string; onChange: (v: string) => void; options: string[]; upper?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
      {options.map((o) => (
        <option key={o} value={o}>{o === 'all' ? 'All' : upper ? o.toUpperCase() : o.replace(/_/g, ' ')}</option>
      ))}
    </select>
  );
}
