/**
 * Places for customers (docs/PLACES.md): which published places are near someone, and which
 * businesses a place holds. Membership is computed from locations, never stored.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { assignToPlaces, distanceKm, isPlaceVisible, loadClaimedBusinesses, PLACES_MAX, PLACES_NEARBY_KM, type PlaceBusiness, type PlaceRow } from '@balkina/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, any, any>;

const PLACE_COLUMNS = 'id, name, slug, refers_to, tagline, photo_url, lat, lng, radius_km, need_total, need_dining, need_care, need_active, status, hidden, stats, stats_at, level1_at, level2_at, published_at, created_at, updated_at';

/** Published places that have not thinned out. */
export async function visiblePlaces(supabase: AdminClient): Promise<PlaceRow[]> {
  const { data } = await supabase.from('places').select(PLACE_COLUMNS).in('status', ['live', 'official']).eq('hidden', false);
  return ((data ?? []) as PlaceRow[]).filter(isPlaceVisible);
}

export interface NearbyPlace {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  photo_url: string | null;
  distance_km: number | null;
  /** The user is standing inside the boundary. */
  inside: boolean;
  businesses: number;
}

/** Place cards for the home screen: within reach of the user, nearest first; all published ones when the position is unknown. */
export function nearbyPlaces(places: PlaceRow[], at: { lat: number; lng: number } | null): NearbyPlace[] {
  const rows = places.map((p) => {
    const d = at ? distanceKm(at.lat, at.lng, p.lat, p.lng) : null;
    return {
      id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, photo_url: p.photo_url,
      distance_km: d === null ? null : Math.round(d * 10) / 10,
      inside: d !== null && d <= p.radius_km,
      businesses: Number(p.stats?.total ?? 0),
      published_at: p.published_at,
    };
  });
  const list = at
    ? rows.filter((r) => (r.distance_km ?? 0) <= PLACES_NEARBY_KM).sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
    : rows.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
  return list.slice(0, PLACES_MAX).map(({ published_at: _unused, ...r }) => r);
}

/** The businesses of one place. Overlapping places are resolved against every non-draft place. */
export async function placeMembers(supabase: AdminClient, place: PlaceRow): Promise<PlaceBusiness[]> {
  const [{ data: all }, businesses] = await Promise.all([
    supabase.from('places').select('id, lat, lng, radius_km').neq('status', 'draft'),
    loadClaimedBusinesses(supabase),
  ]);
  const boundaries = (all ?? []) as Pick<PlaceRow, 'id' | 'lat' | 'lng' | 'radius_km'>[];
  if (!boundaries.some((b) => b.id === place.id)) boundaries.push(place);
  return assignToPlaces(boundaries, businesses).get(place.id) ?? [];
}

const plain = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Matches a place name as a whole word, including its Serbian case forms ("u Luštici", "u Portu",
 * "u Portonovom"). Short names only accept a different final vowel, so "Porto" does not match
 * "port" or "portal".
 */
function nameMatcher(name: string): RegExp | null {
  const n = plain(name);
  if (n.length < 4) return null;
  const stem = /[aeiou]$/.test(n) ? n.slice(0, -1) : n;
  const tail = stem.length >= 6 ? '[a-z]{0,3}' : stem === n ? '' : '[aeiou]';
  return new RegExp(`(^| )${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${tail}( |$)`);
}

/** A published place named in a chat message ("a massage in Porto"), if any. Longest name wins. */
export function placeNamedIn(message: string, places: PlaceRow[]): PlaceRow | null {
  const text = plain(message);
  return [...places].sort((a, b) => b.name.length - a.name.length).find((p) => nameMatcher(p.name)?.test(text)) ?? null;
}
