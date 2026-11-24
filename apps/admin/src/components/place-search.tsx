'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { INPUT } from '@/components/prospect-crm';
import type { GeoResult } from '@/lib/geo-search';

/** Find a location by its name or address (Google) and hand back its centre. */
export function PlaceSearch({ onPick, placeholder = 'Search a name or an address' }: {
  onPick: (result: GeoResult) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // The text put in the box after a pick must not start a new search.
  const settled = useRef('');

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3 || text === settled.current) { setLoading(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/places/search?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const data = (await res.json().catch(() => ({}))) as { results?: GeoResult[]; error?: string };
        if (!res.ok) { setResults(null); setError(data.error ?? 'Search failed'); }
        else { setResults(data.results ?? []); setActive(0); setOpen(true); }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setError('Search failed. Check the connection.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  const choose = (r: GeoResult) => {
    settled.current = r.name;
    setQ(r.name);
    setOpen(false);
    onPick(r);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !results?.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = results[active]; if (r) choose(r); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
        <input
          className={`${INPUT} pl-9 pr-9`}
          value={q}
          onChange={(e) => { settled.current = ''; setQ(e.target.value); }}
          onFocus={() => { if (results?.length) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="place-search-results"
        />
        {loading ? <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" /> : null}
      </div>
      {open && results ? (
        <ul id="place-search-results" role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {results.length === 0 ? <li className="px-3 py-2 text-sm text-gray-500">Nothing found. Try the street or the town.</li> : null}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-2 text-left ${i === active ? 'bg-brand-50' : ''}`}
              >
                <span className="block truncate text-sm font-medium text-gray-900">{r.name}</span>
                {r.address ? <span className="block truncate text-xs text-gray-500">{r.address}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
