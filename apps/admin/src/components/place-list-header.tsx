'use client';

import { PLACE_GRID, PLACE_SORTS, type PlaceQuery, type PlaceSort } from '@/lib/place-list';

const COLUMNS: { label: string; sort?: PlaceSort; className?: string }[] = [
  { label: 'Place', sort: 'name' },
  { label: 'Status' },
  { label: 'Businesses', sort: 'businesses' },
  { label: 'Mix' },
  { label: 'Bookings', sort: 'bookings', className: 'justify-end' },
  { label: 'Level 1', sort: 'readiness' },
  { label: '' },
];

/** Column titles of the Places list. A sortable title sorts by it; a second click reverses the order. */
export function PlaceListHeader({ query, onChange }: { query: PlaceQuery; onChange: (patch: Partial<PlaceQuery>) => void }) {
  return (
    <div className={`hidden border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-gray-500 ${PLACE_GRID}`}>
      {COLUMNS.map((c, i) => {
        const sort = c.sort;
        if (!sort) return <span key={i} className={`flex ${c.className ?? ''}`}>{c.label}</span>;
        const on = query.sort === sort;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(on ? { dir: query.dir === 'asc' ? 'desc' : 'asc' } : { sort, dir: PLACE_SORTS.find((s) => s.value === sort)?.dir ?? 'desc' })}
            className={`flex items-center gap-1 uppercase tracking-wide hover:text-gray-900 ${on ? 'text-gray-900' : ''} ${c.className ?? ''}`}
            title={`Sort by ${c.label.toLowerCase()}`}
          >
            {c.label}
            <svg className={`h-3 w-3 ${on ? '' : 'opacity-0'} ${on && query.dir === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0 6-6m-6 6-6-6" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
