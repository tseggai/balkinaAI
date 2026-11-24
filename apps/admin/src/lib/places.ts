/**
 * Places for the admin (docs/PLACES.md): measure every place from the live data, keep the stored
 * stats, the automatic hide flag and the "first reached" stamps up to date, and suggest where a new
 * place could be drawn. Membership is never stored; it follows the boundary.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assignToPlaces, isPlaceVisible, loadBookings30d, loadClaimedBusinesses, measurePlace, nextHidden, placeFamily, suggestPlaceCandidates,
  type PlaceBusiness, type PlaceCandidate, type PlaceFamily, type PlaceRow, type PlaceStats,
} from '@balkina/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

export interface PlaceMember { id: string; name: string; category: string | null; family: PlaceFamily; bookings_30d: number }

export interface PlaceView extends PlaceRow {
  /** Measured now, from the live data. */
  fresh: PlaceStats;
  members: PlaceMember[];
  /** Customers can see it: published and not thinned out. */
  visible: boolean;
}

export interface PlacesReport {
  places: PlaceView[];
  candidates: PlaceCandidate[];
  /** Migration 080 has not been applied yet. */
  missingTable: boolean;
  /** Places that reached a level for the first time in this run. */
  reached: { name: string; level: 1 | 2 }[];
}

export const placeSlug = (name: string): string =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Measure every place and store the result. Safe to call often: it only writes what changed in meaning. */
export async function refreshPlaces(supabase: AdminClient): Promise<PlacesReport> {
  const { data, error } = await supabase.from('places').select('*').order('created_at', { ascending: true });
  if (error) return { places: [], candidates: [], missingTable: error.code === '42P01' || /places/.test(error.message), reached: [] };
  const rows = (data ?? []) as PlaceRow[];
  const businesses = await loadClaimedBusinesses(supabase);

  const real = rows.filter((p) => p.status !== 'draft');
  const assigned = assignToPlaces(real, businesses);
  const membersOf = (p: PlaceRow): PlaceBusiness[] =>
    p.status === 'draft' ? assignToPlaces([...real, p], businesses).get(p.id) ?? [] : assigned.get(p.id) ?? [];

  const memberIds = new Set<string>();
  const perPlace = new Map<string, PlaceBusiness[]>();
  for (const p of rows) { const m = membersOf(p); perPlace.set(p.id, m); m.forEach((b) => memberIds.add(b.id)); }
  const bookings = await loadBookings30d(supabase, Array.from(memberIds));

  const now = new Date().toISOString();
  const reached: PlacesReport['reached'] = [];
  const places: PlaceView[] = [];
  for (const p of rows) {
    const members = perPlace.get(p.id) ?? [];
    const fresh = measurePlace(p, members, bookings);
    const published = p.status === 'live' || p.status === 'official';
    const hidden = published ? nextHidden(p.hidden, fresh.ratio) : false;
    const level1_at = p.level1_at ?? (fresh.level1 ? now : null);
    const level2_at = p.level2_at ?? (fresh.level2 ? now : null);
    if (fresh.level1 && !p.level1_at) reached.push({ name: p.name, level: 1 });
    if (fresh.level2 && !p.level2_at) reached.push({ name: p.name, level: 2 });
    await supabase.from('places').update({ stats: fresh, stats_at: now, hidden, level1_at, level2_at }).eq('id', p.id);
    const next: PlaceRow = { ...p, stats: fresh, stats_at: now, hidden, level1_at, level2_at };
    places.push({
      ...next,
      fresh,
      members: members
        .map((b) => ({ id: b.id, name: b.name, category: b.category, family: placeFamily(b.category), bookings_30d: bookings.get(b.id) ?? 0 }))
        .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name)),
      visible: isPlaceVisible(next),
    });
  }

  // Where a new place could be drawn: claimed businesses that sit in no place at all.
  const taken = new Set<string>();
  for (const list of assigned.values()) list.forEach((b) => taken.add(b.id));
  const candidates = suggestPlaceCandidates(businesses.filter((b) => !taken.has(b.id)));

  return { places, candidates, missingTable: false, reached };
}
