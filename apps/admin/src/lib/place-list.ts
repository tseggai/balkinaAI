/** Search, filters and sorting for the admin Places list. Pure functions over the measured places. */
import type { PlaceView } from '@/lib/places';

export type PlaceStatusFilter = 'all' | 'draft' | 'watching' | 'live' | 'official';
export type PlaceReadiness = 'any' | 'ready' | 'level1' | 'level2' | 'below' | 'hidden';
export type PlaceSort = 'readiness' | 'name' | 'businesses' | 'bookings' | 'created' | 'published';
export type SortDir = 'asc' | 'desc';

export interface PlaceQuery {
  q: string;
  status: PlaceStatusFilter;
  readiness: PlaceReadiness;
  sort: PlaceSort;
  dir: SortDir;
}

export const DEFAULT_PLACE_QUERY: PlaceQuery = { q: '', status: 'all', readiness: 'any', sort: 'readiness', dir: 'desc' };
export const PLACE_PAGE_SIZE = 20;

/** Column layout shared by the list header and its rows (from the md breakpoint up). */
export const PLACE_GRID = 'md:grid md:grid-cols-[minmax(0,2fr)_96px_minmax(0,1.1fr)_minmax(0,1.7fr)_84px_124px_16px] md:items-center md:gap-4';

export const PLACE_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  watching: { label: 'Watching', className: 'bg-amber-50 text-amber-700' },
  live: { label: 'Live', className: 'bg-green-50 text-green-700' },
  official: { label: 'Official', className: 'bg-brand-50 text-brand-700' },
};

export const PLACE_STATUS_TABS: { value: PlaceStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'watching', label: 'Watching' },
  { value: 'live', label: 'Live' },
  { value: 'official', label: 'Official' },
];

export const PLACE_READINESS: { value: PlaceReadiness; label: string }[] = [
  { value: 'any', label: 'Any density' },
  { value: 'ready', label: 'Ready to publish' },
  { value: 'level1', label: 'Level 1 reached' },
  { value: 'level2', label: 'Level 2 reached' },
  { value: 'below', label: 'Below Level 1' },
  { value: 'hidden', label: 'Hidden: thinned out' },
];

/** Each sort with the direction it starts in. */
export const PLACE_SORTS: { value: PlaceSort; label: string; dir: SortDir }[] = [
  { value: 'readiness', label: 'Closest to Level 1', dir: 'desc' },
  { value: 'name', label: 'Name', dir: 'asc' },
  { value: 'businesses', label: 'Businesses', dir: 'desc' },
  { value: 'bookings', label: 'Bookings in 30 days', dir: 'desc' },
  { value: 'created', label: 'Date added', dir: 'desc' },
  { value: 'published', label: 'Date published', dir: 'desc' },
];

export const isPublished = (p: PlaceView): boolean => p.status === 'live' || p.status === 'official';

/** Level 1 reached and not shown to customers yet. */
export const isReadyToPublish = (p: PlaceView): boolean => p.fresh.level1 && !isPublished(p);

const share = (have: number, need: number): number => (need <= 0 ? 1 : Math.min(1, have / need));

/** How far along the four Level 1 minimums a place is, 0 to 1. Used only to order the list. */
export function placeProgress(p: PlaceView): number {
  const s = p.fresh;
  return (share(s.total, p.need_total) + share(s.dining, p.need_dining) + share(s.care, p.need_care) + share(s.active, p.need_active)) / 4;
}

/** What is still missing for Level 1, in words: ["12 businesses", "4 dining"]. Empty when reached. */
export function placeGaps(p: PlaceView): string[] {
  const s = p.fresh;
  const gap = (have: number, need: number, one: string, many: string): string | null => {
    const n = need - have;
    return n > 0 ? `${n} ${n === 1 ? one : many}` : null;
  };
  return [
    gap(s.total, p.need_total, 'business', 'businesses'),
    gap(s.dining, p.need_dining, 'dining', 'dining'),
    gap(s.care, p.need_care, 'care', 'care'),
    gap(s.active, p.need_active, 'active', 'active'),
  ].filter((x): x is string => x !== null);
}

/** Lower case without diacritics, so "lustica" finds "Luštica". */
const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

function matchesText(p: PlaceView, q: string): boolean {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold([p.name, p.refers_to ?? '', p.slug, p.tagline ?? '', ...p.members.map((m) => m.name)].join(' '));
  return words.every((w) => hay.includes(w));
}

function matchesReadiness(p: PlaceView, r: PlaceReadiness): boolean {
  switch (r) {
    case 'any': return true;
    case 'ready': return isReadyToPublish(p);
    case 'level1': return p.fresh.level1;
    case 'level2': return p.fresh.level2;
    case 'below': return !p.fresh.level1;
    case 'hidden': return isPublished(p) && p.hidden;
  }
}

const levelRank = (p: PlaceView): number => (p.fresh.level2 ? 2 : p.fresh.level1 ? 1 : 0);
const time = (iso: string | null): number | null => (iso ? new Date(iso).getTime() : null);

/** Ascending comparison for one sort; null when either side has no value (those go last either way). */
function compare(a: PlaceView, b: PlaceView, sort: PlaceSort): number | null {
  switch (sort) {
    case 'name': return a.name.localeCompare(b.name);
    case 'businesses': return a.fresh.total - b.fresh.total;
    case 'bookings': return a.fresh.bookings_30d - b.fresh.bookings_30d;
    case 'readiness': return levelRank(a) - levelRank(b) || placeProgress(a) - placeProgress(b) || a.fresh.total - b.fresh.total;
    case 'created': return (time(a.created_at) ?? 0) - (time(b.created_at) ?? 0);
    case 'published': {
      const x = time(a.published_at);
      const y = time(b.published_at);
      return x === null || y === null ? null : x - y;
    }
  }
}

export function queryPlaces(places: PlaceView[], query: PlaceQuery): PlaceView[] {
  const flip = query.dir === 'desc' ? -1 : 1;
  return places
    .filter((p) => (query.status === 'all' || p.status === query.status) && matchesReadiness(p, query.readiness) && matchesText(p, query.q))
    .sort((a, b) => {
      const c = compare(a, b, query.sort);
      if (c === null) {
        const missingA = query.sort === 'published' && !a.published_at;
        const missingB = query.sort === 'published' && !b.published_at;
        return missingA === missingB ? a.name.localeCompare(b.name) : missingA ? 1 : -1;
      }
      return c * flip || a.name.localeCompare(b.name);
    });
}

export function statusCounts(places: PlaceView[]): Record<PlaceStatusFilter, number> {
  const counts: Record<PlaceStatusFilter, number> = { all: places.length, draft: 0, watching: 0, live: 0, official: 0 };
  for (const p of places) counts[p.status] += 1;
  return counts;
}

export const isDefaultQuery = (q: PlaceQuery): boolean => q.q.trim() === '' && q.status === 'all' && q.readiness === 'any';
