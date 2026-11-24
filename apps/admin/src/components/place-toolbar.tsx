'use client';

import { INPUT, SELECT } from '@/components/prospect-crm';
import {
  PLACE_READINESS, PLACE_SORTS, PLACE_STATUS_TABS, isDefaultQuery,
  type PlaceQuery, type PlaceReadiness, type PlaceSort, type PlaceStatusFilter,
} from '@/lib/place-list';

/** Status tabs with counts, search, the density filter and the sort order of the Places list. */
export function PlaceToolbar({ query, counts, shown, total, onChange, onReset }: {
  query: PlaceQuery;
  counts: Record<PlaceStatusFilter, number>;
  shown: number;
  total: number;
  onChange: (patch: Partial<PlaceQuery>) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {PLACE_STATUS_TABS.map((t) => {
          const on = query.status === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ status: t.value })}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'bg-brand-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {t.label} <span className={on ? 'opacity-80' : 'text-gray-400'}>{counts[t.value]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
          </svg>
          <input
            type="search"
            className={`${INPUT} bg-white pl-9`}
            value={query.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Search a place or a business in it"
            aria-label="Search places"
          />
        </div>
        <select className={`${SELECT} min-w-0 flex-1 sm:flex-none`} value={query.readiness} onChange={(e) => onChange({ readiness: e.target.value as PlaceReadiness })} aria-label="Density">
          {PLACE_READINESS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          className={`${SELECT} min-w-0 flex-1 sm:flex-none`}
          value={query.sort}
          onChange={(e) => { const sort = e.target.value as PlaceSort; onChange({ sort, dir: PLACE_SORTS.find((s) => s.value === sort)?.dir ?? 'desc' }); }}
          aria-label="Sort by"
        >
          {PLACE_SORTS.map((s) => <option key={s.value} value={s.value}>Sort: {s.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => onChange({ dir: query.dir === 'asc' ? 'desc' : 'asc' })}
          className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
          title={query.dir === 'asc' ? 'Ascending. Click for descending.' : 'Descending. Click for ascending.'}
          aria-label="Reverse the order"
        >
          <svg className={`h-4 w-4 transition-transform ${query.dir === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0 6-6m-6 6-6-6" />
          </svg>
        </button>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
        <span>{shown === total ? `${total} ${total === 1 ? 'place' : 'places'}` : `${shown} of ${total} places`}</span>
        {isDefaultQuery(query) ? null : <button type="button" className="font-medium text-brand-600 hover:underline" onClick={onReset}>Clear filters</button>}
      </p>
    </div>
  );
}
