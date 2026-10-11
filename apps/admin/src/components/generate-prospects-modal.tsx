'use client';

import { useMemo, useState } from 'react';
import { GROWTH_COUNTRIES, GROWTH_VERTICALS } from '@balkina/shared';

type Phase = 'setup' | 'preparing' | 'searching' | 'enriching' | 'done' | 'error';

interface Target { id: string; vertical: string; city: string; country: string; query: string }

interface Props {
  onClose: () => void;
  onFinished: () => void;
}

const PAGE_OPTIONS = [
  { pages: 1, label: 'Top 20 per search' },
  { pages: 2, label: 'Top 40 per search' },
  { pages: 3, label: 'Top 60 per search' },
];

export function GenerateProspectsModal({ onClose, onFinished }: Props) {
  const [selCountries, setSelCountries] = useState<string[]>(['rs']);
  const [selCities, setSelCities] = useState<{ city: string; country: string }[]>([]);
  const [selVerticals, setSelVerticals] = useState<string[]>(GROWTH_VERTICALS.filter((v) => v.tier === 1).map((v) => v.key));
  const [customCity, setCustomCity] = useState('');
  const [customCountry, setCustomCountry] = useState('rs');
  const [pages, setPages] = useState(3);
  const [autoEnrich, setAutoEnrich] = useState(true);

  const [phase, setPhase] = useState<Phase>('setup');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [stats, setStats] = useState({ found: 0, inserted: 0, updated: 0, requests: 0, legacy: 0, enriched: 0, emails: 0, enrichSkipped: 0 });
  const [error, setError] = useState('');
  const [extraCities, setExtraCities] = useState<{ city: string; country: string }[]>([]);

  const countries = GROWTH_COUNTRIES.filter((c) => selCountries.includes(c.code));
  const cityOptions = useMemo(
    () => [
      ...countries.flatMap((c) => c.cities.map((city) => ({ city, country: c.code }))),
      ...extraCities.filter((e) => selCountries.includes(e.country)),
    ],
    [countries, extraCities, selCountries]
  );
  const cityKey = (c: { city: string; country: string }) => `${c.city}|${c.country}`;
  const selectedCityKeys = new Set(selCities.map(cityKey));
  const combos = selCities.length * selVerticals.length;
  const maxRequests = combos * pages;

  const toggleCountry = (code: string) => {
    const next = selCountries.includes(code) ? selCountries.filter((c) => c !== code) : [...selCountries, code];
    setSelCountries(next);
    setSelCities(selCities.filter((c) => next.includes(c.country)));
  };
  const toggleCity = (c: { city: string; country: string }) => {
    setSelCities(selectedCityKeys.has(cityKey(c)) ? selCities.filter((x) => cityKey(x) !== cityKey(c)) : [...selCities, c]);
  };
  const toggleVertical = (key: string) => {
    setSelVerticals(selVerticals.includes(key) ? selVerticals.filter((k) => k !== key) : [...selVerticals, key]);
  };
  const addCustomCity = () => {
    const city = customCity.trim();
    if (!city) return;
    const entry = { city, country: customCountry };
    if (!cityOptions.some((o) => cityKey(o) === cityKey(entry))) setExtraCities([...extraCities, entry]);
    if (!selectedCityKeys.has(cityKey(entry))) setSelCities([...selCities, entry]);
    setCustomCity('');
  };

  const run = async () => {
    setError('');
    setPhase('preparing');
    try {
      const prep = await fetch('/api/admin/growth/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cities: selCities, verticals: selVerticals }),
      });
      const prepJson = await prep.json();
      if (!prep.ok) throw new Error(prepJson.error ?? 'Could not prepare searches');
      const targets: Target[] = prepJson.targets ?? [];

      // Search in small chunks so each request stays well inside the serverless time limit.
      setPhase('searching');
      setProgress({ done: 0, total: targets.length });
      const s = { found: 0, inserted: 0, updated: 0, requests: 0, legacy: 0, enriched: 0, emails: 0, enrichSkipped: 0 };
      const CHUNK = 2;
      for (let i = 0; i < targets.length; i += CHUNK) {
        const chunk = targets.slice(i, i + CHUNK);
        const res = await fetch('/api/admin/growth/prospector', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_ids: chunk.map((t) => t.id), limit: chunk.length, max_pages: pages }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Search failed');
        s.found += json.places_found ?? 0;
        s.inserted += json.inserted ?? 0;
        s.updated += json.updated ?? 0;
        s.requests += json.api_requests ?? 0;
        s.legacy += json.api_used?.legacy ?? 0;
        setStats({ ...s });
        setProgress({ done: Math.min(i + CHUNK, targets.length), total: targets.length });
        if (json.stopped_reason) throw new Error(json.stopped_reason);
      }

      if (autoEnrich) {
        setPhase('enriching');
        const targetIds = targets.map((t) => t.id);
        setProgress({ done: 0, total: s.inserted + s.updated });
        let processedTotal = 0;
        for (let round = 0; round < 60; round++) {
          const res = await fetch('/api/admin/growth/enricher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search_target_ids: targetIds, limit: 16 }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? 'Enrichment failed');
          if (!json.processed) break;
          processedTotal += json.processed;
          s.enriched += json.enriched ?? 0;
          s.enrichSkipped += json.skipped ?? 0;
          s.emails += json.emails_found ?? 0;
          setStats({ ...s });
          setProgress({ done: processedTotal, total: Math.max(processedTotal, s.inserted + s.updated) });
        }
      }

      setPhase('done');
      onFinished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('error');
      onFinished();
    }
  };

  const busy = phase === 'preparing' || phase === 'searching' || phase === 'enriching';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={busy ? undefined : onClose}>
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-900">Generate prospects</h2>
        <p className="mt-1 text-sm text-gray-500">
          Pick where and what kind of businesses to find. Balkina searches Google Places, scores each business, and (optionally) visits their websites for emails, services and prices.
        </p>

        {phase === 'setup' && (
          <>
            <Section title="1. Countries">
              <div className="flex flex-wrap gap-1.5">
                {GROWTH_COUNTRIES.map((c) => (
                  <Chip key={c.code} on={selCountries.includes(c.code)} onClick={() => toggleCountry(c.code)}>{c.name}</Chip>
                ))}
              </div>
            </Section>

            <Section title="2. Cities" hint={`${selCities.length} selected`}>
              {countries.length === 0 && <p className="text-sm text-gray-400">Pick a country first.</p>}
              {countries.map((c) => {
                const opts = cityOptions.filter((o) => o.country === c.code);
                const allOn = opts.every((o) => selectedCityKeys.has(cityKey(o)));
                return (
                  <div key={c.code} className="mb-2 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setSelCities(allOn ? selCities.filter((x) => x.country !== c.code) : [...selCities.filter((x) => x.country !== c.code), ...opts])}
                      className="mr-1 w-full text-left text-xs font-medium text-gray-500 hover:text-brand-700 sm:w-24"
                    >
                      {c.name.split(' ')[0]} · {allOn ? 'none' : 'all'}
                    </button>
                    {opts.map((o) => (
                      <Chip key={cityKey(o)} on={selectedCityKeys.has(cityKey(o))} onClick={() => toggleCity(o)}>{o.city}</Chip>
                    ))}
                  </div>
                );
              })}
              <div className="mt-2 flex items-center gap-2">
                <select value={customCountry} onChange={(e) => setCustomCountry(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                  {GROWTH_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.code.toUpperCase()}</option>)}
                </select>
                <input
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomCity(); } }}
                  placeholder="Add another city"
                  className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button onClick={addCustomCity} className="text-sm text-brand-600 hover:underline">add</button>
              </div>
            </Section>

            <Section title="3. Business types" hint={`${selVerticals.length} selected`}>
              <div className="flex flex-wrap gap-1.5">
                {GROWTH_VERTICALS.map((v) => (
                  <Chip key={v.key} on={selVerticals.includes(v.key)} onClick={() => toggleVertical(v.key)}>{v.label}</Chip>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <button onClick={() => setSelVerticals(GROWTH_VERTICALS.filter((v) => v.tier === 1).map((v) => v.key))} className="text-brand-600 hover:underline">beauty & barbers</button>
                <button onClick={() => setSelVerticals(GROWTH_VERTICALS.filter((v) => v.tier <= 2).map((v) => v.key))} className="text-brand-600 hover:underline">beauty + wellness</button>
                <button onClick={() => setSelVerticals(GROWTH_VERTICALS.map((v) => v.key))} className="text-brand-600 hover:underline">everything</button>
                <button onClick={() => setSelVerticals([])} className="text-gray-500 hover:underline">clear</button>
              </div>
            </Section>

            <Section title="4. Depth">
              <div className="flex flex-wrap items-center gap-4">
                <select value={pages} onChange={(e) => setPages(Number(e.target.value))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                  {PAGE_OPTIONS.map((o) => <option key={o.pages} value={o.pages}>{o.label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={autoEnrich} onChange={(e) => setAutoEnrich(e.target.checked)} />
                  Enrich automatically (visit websites for emails, services, prices)
                </label>
              </div>
            </Section>

            <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-sm">
              <div className="text-gray-600">
                <span className="font-semibold text-gray-900">{combos}</span> searches ({selCities.length} cities × {selVerticals.length} types)
                · up to <span className="font-semibold text-gray-900">{combos * pages * 20}</span> businesses
                · about {maxRequests} Google requests (≈ €{(maxRequests * 0.03).toFixed(2)}), enrichment ≈ €{(combos * pages * 20 * 0.002).toFixed(2)}
                {combos > 60 && <span className="ml-2 text-red-600">max 60 searches per run</span>}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={run}
                disabled={combos === 0 || combos > 60}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Generate prospects
              </button>
            </div>
          </>
        )}

        {phase !== 'setup' && (
          <div className="mt-6">
            <ProgressRow label="Preparing searches" state={phase === 'preparing' ? 'active' : 'done'} />
            <ProgressRow
              label={`Searching Google Places (${progress.total ? `${phase === 'searching' ? progress.done : progress.total}/${progress.total}` : '…'})`}
              state={phase === 'preparing' ? 'pending' : phase === 'searching' ? 'active' : 'done'}
              detail={`${stats.found} found · ${stats.inserted} new · ${stats.updated} refreshed · ${stats.requests} requests${stats.legacy ? ` · ${stats.legacy} via legacy API` : ''}`}
            />
            {autoEnrich && (
              <ProgressRow
                label={`Enriching websites${phase === 'enriching' ? ` (${progress.done} done)` : ''}`}
                state={phase === 'enriching' ? 'active' : phase === 'done' ? 'done' : phase === 'error' && stats.enriched + stats.enrichSkipped > 0 ? 'done' : 'pending'}
                detail={`${stats.enriched} enriched · ${stats.enrichSkipped} skipped (Instagram-only or no website) · ${stats.emails} emails found`}
              />
            )}
            {phase === 'searching' || phase === 'enriching' ? (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-2 bg-brand-600 transition-all" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 5}%` }} />
              </div>
            ) : null}
            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {phase === 'done' && (
              <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                Done. {stats.inserted} new prospects added{autoEnrich ? `, ${stats.enriched} enriched, ${stats.emails} emails found` : ''}. Next: review them in the list, then build their pages and start outreach.
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} disabled={busy} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                {busy ? 'Working…' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${on ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {children}
    </button>
  );
}

function ProgressRow({ label, state, detail }: { label: string; state: 'pending' | 'active' | 'done'; detail?: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${state === 'done' ? 'bg-green-100 text-green-700' : state === 'active' ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'}`}>
        {state === 'done' ? '✓' : state === 'active' ? '…' : '·'}
      </span>
      <div>
        <div className={`text-sm ${state === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>{label}</div>
        {detail && state !== 'pending' && <div className="text-xs text-gray-500">{detail}</div>}
      </div>
    </div>
  );
}
