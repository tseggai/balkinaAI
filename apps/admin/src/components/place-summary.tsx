import { isPublished, isReadyToPublish, type PlaceQuery } from '@/lib/place-list';
import type { PlaceView } from '@/lib/places';

const TILE = 'rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40';

/** The four numbers above the list. Each tile is also a shortcut to the matching filter. */
export function PlaceSummary({ places, onFilter }: { places: PlaceView[]; onFilter: (patch: Partial<PlaceQuery>) => void }) {
  const shown = places.filter((p) => p.visible).length;
  const published = places.filter(isPublished).length;
  const ready = places.filter(isReadyToPublish).length;
  const businesses = places.reduce((n, p) => n + p.fresh.total, 0);
  const bookings = places.reduce((n, p) => n + p.fresh.bookings_30d, 0);
  const tiles: { label: string; value: number; sub: string; patch: Partial<PlaceQuery> }[] = [
    { label: 'Places', value: places.length, sub: `${businesses} ${businesses === 1 ? 'business' : 'businesses'} inside them`, patch: { status: 'all', readiness: 'any', q: '' } },
    { label: 'Shown to customers', value: shown, sub: published > shown ? `${published - shown} hidden: thinned out` : 'published and dense enough', patch: { status: 'live', readiness: 'any' } },
    { label: 'Ready to publish', value: ready, sub: 'Level 1 reached, not published', patch: { status: 'all', readiness: 'ready' } },
    { label: 'Bookings in 30 days', value: bookings, sub: 'across all places', patch: { sort: 'bookings', dir: 'desc' } },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <button key={t.label} type="button" className={TILE} onClick={() => onFilter(t.patch)}>
          <span className="block text-xs text-gray-500">{t.label}</span>
          <span className="mt-0.5 block text-2xl font-bold text-gray-900">{t.value}</span>
          <span className="block truncate text-[11px] text-gray-400">{t.sub}</span>
        </button>
      ))}
    </div>
  );
}
