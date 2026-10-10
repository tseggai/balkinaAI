'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GrowthSearchTarget } from '@balkina/shared';

export default function TargetsPage() {
  const [targets, setTargets] = useState<GrowthSearchTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [form, setForm] = useState({ segment: 'tenant', vertical: '', query: '', city: '', country: 'rs', language: 'sr', priority: 5 });

  // Bulk selection: countries → cities → verticals. Empty = all.
  const [selCountries, setSelCountries] = useState<string[]>([]);
  const [selCities, setSelCities] = useState<string[]>([]);
  const [selVerticals, setSelVerticals] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/growth/targets');
    const json = await res.json();
    setTargets(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, updates: Partial<Pick<GrowthSearchTarget, 'enabled' | 'priority' | 'query'>>) => {
    const res = await fetch('/api/admin/growth/targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    else setMessage(`Error: ${(await res.json()).error}`);
  };

  const remove = async (t: GrowthSearchTarget) => {
    if (!confirm(`Delete target "${t.query} · ${t.city}"?`)) return;
    const res = await fetch(`/api/admin/growth/targets?id=${t.id}`, { method: 'DELETE' });
    if (res.ok) setTargets((prev) => prev.filter((x) => x.id !== t.id));
  };

  const runOne = async (t: GrowthSearchTarget) => {
    setRunning(t.id);
    setMessage('');
    const res = await fetch('/api/admin/growth/prospector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1, target_ids: [t.id] }),
    });
    const json = await res.json();
    if (!res.ok) setMessage(`Error: ${json.error}`);
    else if (json.stopped_reason) setMessage(`Error: ${json.stopped_reason}`);
    else setMessage(`"${t.query} · ${t.city}": found ${json.places_found}, new ${json.inserted}, refreshed ${json.updated}.`);
    setRunning(null);
    load();
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/admin/growth/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, priority: Number(form.priority) }),
    });
    const json = await res.json();
    if (!res.ok) { setMessage(`Error: ${json.error}`); return; }
    setForm({ ...form, vertical: '', query: '', city: '' });
    load();
  };

  const bulk = async (enabled: boolean, override?: { countries?: string[]; cities?: string[]; verticals?: string[] }) => {
    setBulkBusy(true);
    setMessage('');
    const body = {
      enabled,
      countries: override?.countries ?? selCountries,
      cities: override?.cities ?? selCities,
      verticals: override?.verticals ?? selVerticals,
    };
    const res = await fetch('/api/admin/growth/targets/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) setMessage(`Error: ${json.error}`);
    else setMessage(`${enabled ? 'Enabled' : 'Disabled'} ${json.updated} target${json.updated === 1 ? '' : 's'}.`);
    setBulkBusy(false);
    load();
  };

  // ── Derived lists ──────────────────────────────────────────────────────────
  const countries = useMemo(() => Array.from(new Set(targets.map((t) => t.country))).sort(), [targets]);
  const citiesByCountry = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of targets) {
      const list = m.get(t.country) ?? [];
      if (!list.includes(t.city)) list.push(t.city);
      m.set(t.country, list);
    }
    for (const list of m.values()) list.sort();
    return m;
  }, [targets]);
  const verticals = useMemo(() => Array.from(new Set(targets.map((t) => t.vertical))).sort(), [targets]);

  const activeCountries = selCountries.length ? selCountries : countries;
  const cityOptions = activeCountries.flatMap((c) => (citiesByCountry.get(c) ?? []).map((city) => ({ city, country: c })));

  // Targets matching the current bulk selection (for the preview count and the list below).
  const matches = targets.filter(
    (t) =>
      (selCountries.length === 0 || selCountries.includes(t.country)) &&
      (selCities.length === 0 || selCities.includes(t.city)) &&
      (selVerticals.length === 0 || selVerticals.includes(t.vertical))
  );
  const matchesEnabled = matches.filter((t) => t.enabled).length;

  const toggleIn = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const byCity = new Map<string, GrowthSearchTarget[]>();
  for (const t of matches) {
    const key = `${t.city}|${t.country}`;
    byCity.set(key, [...(byCity.get(key) ?? []), t]);
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search targets</h1>
          <p className="mt-1 text-sm text-gray-500">
            The vertical × city matrix the prospector runs. {targets.filter((t) => t.enabled).length} enabled of {targets.length}.
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message} <button onClick={() => setMessage('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Bulk selection */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Bulk enable / disable</h2>
          <p className="text-xs text-gray-500">
            Pick countries, then cities, then business types. Nothing selected means all.
            {' '}<span className="font-medium text-gray-700">{matches.length} targets match · {matchesEnabled} enabled</span>
          </p>
        </div>

        <ChipRow
          label="Countries"
          options={countries.map((c) => ({ value: c, label: c.toUpperCase() }))}
          selected={selCountries}
          onToggle={(v) => { toggleIn(selCountries, v, setSelCountries); setSelCities([]); }}
          onClear={() => { setSelCountries([]); setSelCities([]); }}
        />
        <ChipRow
          label="Cities"
          options={cityOptions.map((o) => ({ value: o.city, label: activeCountries.length > 1 ? `${o.city} (${o.country.toUpperCase()})` : o.city }))}
          selected={selCities}
          onToggle={(v) => toggleIn(selCities, v, setSelCities)}
          onClear={() => setSelCities([])}
        />
        <ChipRow
          label="Business types"
          options={verticals.map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))}
          selected={selVerticals}
          onToggle={(v) => toggleIn(selVerticals, v, setSelVerticals)}
          onClear={() => setSelVerticals([])}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => bulk(true)}
            disabled={bulkBusy || matches.length === 0}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Enable {matches.length} matching
          </button>
          <button
            onClick={() => bulk(false)}
            disabled={bulkBusy || matches.length === 0}
            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Disable {matches.length} matching
          </button>
          <span className="text-xs text-gray-400">Only the matching targets are listed below.</span>
        </div>
      </div>

      {/* Add target */}
      <form onSubmit={add} className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-8">
        <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
          <option value="tenant">tenant</option>
          <option value="property">property</option>
        </select>
        <input required value={form.vertical} onChange={(e) => setForm({ ...form, vertical: e.target.value })} placeholder="vertical (snake_case)" className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        <input required value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} placeholder="search text (local language)" className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        <input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="rs" maxLength={2} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        <input required value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="sr" maxLength={5} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Add target</button>
      </form>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          {Array.from(byCity.entries()).map(([key, list]) => {
            const [city = '', country = ''] = key.split('|');
            const enabledCount = list.filter((t) => t.enabled).length;
            return (
              <div key={key} className="rounded-xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {city} <span className="font-normal text-gray-400">{country.toUpperCase()} · {enabledCount}/{list.length} enabled</span>
                  </h2>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => bulk(true, { countries: [country], cities: [city], verticals: selVerticals })} className="text-brand-600 hover:underline">enable all</button>
                    <button onClick={() => bulk(false, { countries: [country], cities: [city], verticals: selVerticals })} className="text-gray-500 hover:underline">disable all</button>
                  </div>
                </div>
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {list.map((t) => (
                      <tr key={t.id} className={t.enabled ? '' : 'opacity-50'}>
                        <td className="w-10 px-4 py-2">
                          <input type="checkbox" checked={t.enabled} onChange={(e) => patch(t.id, { enabled: e.target.checked })} />
                        </td>
                        <td className="px-2 py-2 text-gray-700">{t.vertical.replace(/_/g, ' ')}</td>
                        <td className="px-2 py-2">
                          <input
                            defaultValue={t.query}
                            onBlur={(e) => e.target.value !== t.query && patch(t.id, { query: e.target.value })}
                            className="w-full rounded border border-transparent px-1 py-0.5 text-gray-900 hover:border-gray-300 focus:border-brand-500"
                          />
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-400">{t.language}</td>
                        <td className="px-2 py-2">
                          <select value={t.priority} onChange={(e) => patch(t.id, { priority: Number(e.target.value) })} className="rounded border border-gray-200 px-1 py-0.5 text-xs">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>P{n}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-500">
                          {t.last_run_at ? `${new Date(t.last_run_at).toLocaleDateString()} · ${t.last_results ?? 0} found · ${t.total_found} total` : 'never run'}
                        </td>
                        <td className="px-2 py-2 text-right text-xs">
                          <button onClick={() => runOne(t)} disabled={running === t.id} className="mr-3 text-brand-600 hover:underline disabled:opacity-50">
                            {running === t.id ? 'running…' : 'run'}
                          </button>
                          <button onClick={() => remove(t)} className="text-gray-400 hover:text-red-600">delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChipRow({
  label, options, selected, onToggle, onClear,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-28 text-xs font-medium text-gray-500">{label}</span>
      <button
        onClick={onClear}
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${selected.length === 0 ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        All
      </button>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${on ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
