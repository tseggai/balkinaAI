'use client';

import { PLACE_GRID, PLACE_STATUS, isPublished, isReadyToPublish, placeGaps } from '@/lib/place-list';
import type { PlaceView } from '@/lib/places';

function Mix({ label, have, need }: { label: string; have: number; need: number }) {
  const met = need === 0 || have >= need;
  return (
    <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${met ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
      {label} {have}/{need}
    </span>
  );
}

/** One place in the list: a table row from the md breakpoint up, a compact card below it. Opens the detail. */
export function PlaceRow({ place, selected, onOpen }: { place: PlaceView; selected: boolean; onOpen: () => void }) {
  const s = place.fresh;
  const status = PLACE_STATUS[place.status] ?? PLACE_STATUS.watching!;
  const published = isPublished(place);
  const met = s.total >= place.need_total;
  const pct = place.need_total > 0 ? Math.min(100, Math.round((s.total / place.need_total) * 100)) : 100;
  const gaps = placeGaps(place);

  const badges = (
    <span className="flex flex-wrap items-center gap-1">
      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
      {published && place.hidden ? <span className="whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700" title="Below 70% of its thresholds. It returns on its own at 100%.">Hidden</span> : null}
    </span>
  );

  const level = s.level2 ? <span className="whitespace-nowrap rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold text-white">Level 2</span>
    : isReadyToPublish(place) ? <span className="whitespace-nowrap rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">Ready to publish</span>
    : s.level1 ? <span className="whitespace-nowrap rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">Reached</span>
    : <span className="whitespace-nowrap text-xs text-gray-500" title={`Still needed: ${gaps.join(', ')}`}>Not yet</span>;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className={`cursor-pointer px-4 py-3 outline-none transition-colors hover:bg-gray-50 focus-visible:bg-brand-50 ${selected ? 'bg-brand-50/60' : ''} ${PLACE_GRID}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-brand-600">
          {place.photo_url ? <img src={place.photo_url} alt="" className="h-full w-full object-cover" /> : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{place.name}</span>
          <span className="block truncate text-xs text-gray-500">{place.refers_to ?? `${Number(place.radius_km)} km radius`}</span>
        </span>
        <span className="flex-shrink-0 md:hidden">{badges}</span>
      </div>

      <div className="hidden md:block">{badges}</div>

      <div className="mt-3 md:mt-0">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-gray-500 md:hidden">Businesses</span>
          <span className={`tabular-nums ${met ? 'font-semibold text-green-700' : 'text-gray-700'}`}>{s.total} / {place.need_total}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full ${met ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1 md:mt-0">
        <Mix label="Dining" have={s.dining} need={place.need_dining} />
        <Mix label="Care" have={s.care} need={place.need_care} />
        <Mix label="Active" have={s.active} need={place.need_active} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 md:contents">
        <span className="text-xs tabular-nums text-gray-600 md:text-right md:text-sm md:text-gray-900">
          {s.bookings_30d}<span className="md:hidden"> {s.bookings_30d === 1 ? 'booking' : 'bookings'} in 30 days</span>
        </span>
        <span>{level}</span>
      </div>

      <svg className="hidden h-4 w-4 text-gray-300 md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </div>
  );
}
