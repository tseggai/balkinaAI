/**
 * Places (Migration 080, docs/PLACES.md): a place groups the independently signed-up businesses of a
 * destination by geography. Creating a place (name, boundary, thresholds) is a human decision;
 * membership, density, hiding and candidate suggestions are computed here, shared by the customer
 * APIs (apps/web) and the admin page (apps/admin).
 */

export type PlaceStatus = 'draft' | 'watching' | 'live' | 'official';

/** One density measurement of a place. */
export interface PlaceStats {
  total: number;
  dining: number;
  care: number;
  active: number;
  other: number;
  bookings_30d: number;
  businesses_with_booking_30d: number;
  /** Lowest of count / minimum across the four Level 1 minimums (1 = exactly at threshold). */
  ratio: number;
  level1: boolean;
  level2: boolean;
}

export interface PlaceRow {
  id: string;
  /** The single display-name setting. Never hard-code a place name anywhere else. */
  name: string;
  slug: string;
  /** Internal note: what the place refers to (not shown to customers). */
  refers_to: string | null;
  tagline: string | null;
  photo_url: string | null;
  lat: number;
  lng: number;
  radius_km: number;
  need_total: number;
  need_dining: number;
  need_care: number;
  need_active: number;
  status: PlaceStatus;
  /** Set automatically when a published place thins out (see nextHidden). */
  hidden: boolean;
  stats: Partial<PlaceStats> | null;
  stats_at: string | null;
  level1_at: string | null;
  level2_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A claimed, bookable business with the coordinates of its locations. */
export interface PlaceBusiness {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  avg_rating: number | null;
  review_count: number | null;
  /** Top-level category name ("Hospitality", "Beauty & Personal Care"…). */
  category: string | null;
  /** Child category name when the business is tagged at that level ("Spa"). */
  subcategory: string | null;
  points: { lat: number; lng: number }[];
}

export type PlaceFamily = 'dining' | 'care' | 'active' | 'other';

/** Category families a guest expects in a destination: somewhere to eat, to be looked after, something to do. */
export const PLACE_FAMILIES: Record<Exclude<PlaceFamily, 'other'>, string[]> = {
  dining: ['Hospitality', 'Food & Nutrition'],
  care: ['Beauty & Personal Care', 'Health & Wellness'],
  active: ['Fitness & Sports', 'Rentals & Tours', 'Events & Entertainment'],
};

export function placeFamily(topCategory: string | null | undefined): PlaceFamily {
  if (!topCategory) return 'other';
  if (PLACE_FAMILIES.dining.includes(topCategory)) return 'dining';
  if (PLACE_FAMILIES.care.includes(topCategory)) return 'care';
  if (PLACE_FAMILIES.active.includes(topCategory)) return 'active';
  return 'other';
}

/** Level 1 minimums by size of place; editable per place. */
export const PLACE_SIZE_DEFAULTS = {
  small: { need_total: 8, need_dining: 3, need_care: 1, need_active: 1 },
  medium: { need_total: 10, need_dining: 3, need_care: 1, need_active: 1 },
  large: { need_total: 15, need_dining: 4, need_care: 2, need_active: 2 },
} as const;

/** Places further than this from the user are not offered on the home screen. */
export const PLACES_NEARBY_KM = 50;
/** Most place cards shown at once. */
export const PLACES_MAX = 6;
/** A published place hides below this share of its thresholds and returns at 100%. */
export const PLACE_HIDE_RATIO = 0.7;

/** Great-circle distance in kilometres. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

type Boundary = Pick<PlaceRow, 'id' | 'lat' | 'lng' | 'radius_km'>;

/**
 * Which businesses belong to which place. Each location of a business goes to the place whose
 * boundary holds it; where places overlap, to the smallest one. A business with branches in two
 * places belongs to both.
 */
export function assignToPlaces(places: Boundary[], businesses: PlaceBusiness[]): Map<string, PlaceBusiness[]> {
  const out = new Map<string, PlaceBusiness[]>(places.map((p) => [p.id, []]));
  const bySize = [...places].sort((x, y) => x.radius_km - y.radius_km);
  for (const b of businesses) {
    const homes = new Set<string>();
    for (const point of b.points) {
      const home = bySize.find((p) => distanceKm(p.lat, p.lng, point.lat, point.lng) <= p.radius_km);
      if (home) homes.add(home.id);
    }
    for (const id of homes) out.get(id)!.push(b);
  }
  return out;
}

type Needs = Pick<PlaceRow, 'need_total' | 'need_dining' | 'need_care' | 'need_active'>;

/** Density of a place from its members and their bookings of the last 30 days. */
export function measurePlace(needs: Needs, members: PlaceBusiness[], bookings?: Map<string, number>): PlaceStats {
  const count = { dining: 0, care: 0, active: 0, other: 0 };
  for (const m of members) count[placeFamily(m.category)] += 1;
  const total = members.length;
  const parts: [number, number][] = [
    [total, needs.need_total], [count.dining, needs.need_dining], [count.care, needs.need_care], [count.active, needs.need_active],
  ];
  const ratio = Math.min(...parts.filter(([, need]) => need > 0).map(([have, need]) => have / need), Number.POSITIVE_INFINITY);
  const level1 = total > 0 && ratio >= 1;
  let bookings30 = 0;
  let booked = 0;
  for (const m of members) {
    const n = bookings?.get(m.id) ?? 0;
    bookings30 += n;
    if (n > 0) booked += 1;
  }
  return {
    total, ...count,
    bookings_30d: bookings30,
    businesses_with_booking_30d: booked,
    ratio: Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : 0,
    level1,
    // Level 2: worth taking to the property owner.
    level2: level1 && bookings30 >= 5 * total && booked * 2 >= total,
  };
}

/** Hysteresis for a published place: hide below 70% of its thresholds, show again only at 100%. */
export function nextHidden(currentlyHidden: boolean, ratio: number): boolean {
  if (ratio < PLACE_HIDE_RATIO) return true;
  if (ratio >= 1) return false;
  return currentlyHidden;
}

/** Customers see a place when it is published and has not thinned out. */
export const isPlaceVisible = (p: Pick<PlaceRow, 'status' | 'hidden'>): boolean =>
  (p.status === 'live' || p.status === 'official') && !p.hidden;

export interface PlaceCandidate {
  lat: number;
  lng: number;
  count: number;
  /** A few member names, to recognise the spot. */
  names: string[];
}

/**
 * Clusters of claimed businesses that belong to no place: where a new place could be drawn.
 * Greedy: take the business with the most neighbours within `radiusKm`, report the cluster, remove
 * its members, repeat. A suggestion only; a person names and approves a place.
 */
export function suggestPlaceCandidates(
  unassigned: PlaceBusiness[],
  opts: { radiusKm?: number; min?: number; max?: number } = {},
): PlaceCandidate[] {
  const radiusKm = opts.radiusKm ?? 0.5;
  const min = opts.min ?? 8;
  const max = opts.max ?? 10;
  let pool = unassigned.filter((b) => b.points.length > 0).map((b) => ({ b, p: b.points[0]! }));
  const out: PlaceCandidate[] = [];
  while (pool.length >= min && out.length < max) {
    let best: typeof pool = [];
    for (const seed of pool) {
      const near = pool.filter((x) => distanceKm(seed.p.lat, seed.p.lng, x.p.lat, x.p.lng) <= radiusKm);
      if (near.length > best.length) best = near;
    }
    if (best.length < min) break;
    out.push({
      lat: best.reduce((s, x) => s + x.p.lat, 0) / best.length,
      lng: best.reduce((s, x) => s + x.p.lng, 0) / best.length,
      count: best.length,
      names: best.slice(0, 5).map((x) => x.b.name),
    });
    const taken = new Set(best.map((x) => x.b.id));
    pool = pool.filter((x) => !taken.has(x.b.id));
  }
  return out;
}

/* ---------- Loading (shared by apps/web and apps/admin; both pass a service-role Supabase client) ---------- */

// A structural stand-in for SupabaseClient, so this package needs no Supabase dependency.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

const chunk = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * Every business that may count toward a place: claimed (owner login), active, with at least one
 * public service and a located address. Unclaimed and seeded businesses are never included.
 */
export async function loadClaimedBusinesses(db: Db): Promise<PlaceBusiness[]> {
  const { data: tenantRows } = await db
    .from('tenants')
    .select('id, name, slug, logo_url, cover_image_url, description, avg_rating, review_count, category_id')
    .eq('status', 'active')
    .not('user_id', 'is', null)
    .limit(5000);
  type T = { id: string; name: string; slug: string | null; logo_url: string | null; cover_image_url: string | null; description: string | null; avg_rating: number | null; review_count: number | null; category_id: string | null };
  const tenants = (tenantRows ?? []) as T[];
  if (tenants.length === 0) return [];
  const ids = tenants.map((t) => t.id);

  const { data: catRows } = await db.from('categories').select('id, name, parent_id').limit(2000);
  const cats = new Map<string, { name: string; parent_id: string | null }>();
  for (const c of (catRows ?? []) as { id: string; name: string; parent_id: string | null }[]) cats.set(c.id, c);

  const points = new Map<string, { lat: number; lng: number }[]>();
  const bookable = new Set<string>();
  for (const part of chunk(ids, 150)) {
    const [{ data: locs }, { data: svcs }] = await Promise.all([
      db.from('tenant_locations').select('tenant_id, latitude, longitude').in('tenant_id', part).not('latitude', 'is', null).not('longitude', 'is', null),
      db.from('services').select('tenant_id').in('tenant_id', part).eq('visibility', 'public').limit(5000),
    ]);
    for (const l of (locs ?? []) as { tenant_id: string; latitude: number; longitude: number }[]) {
      const arr = points.get(l.tenant_id) ?? [];
      arr.push({ lat: Number(l.latitude), lng: Number(l.longitude) });
      points.set(l.tenant_id, arr);
    }
    for (const s of (svcs ?? []) as { tenant_id: string }[]) bookable.add(s.tenant_id);
  }

  return tenants
    .filter((t) => bookable.has(t.id) && (points.get(t.id)?.length ?? 0) > 0)
    .map((t) => {
      const cat = t.category_id ? cats.get(t.category_id) : undefined;
      const parent = cat?.parent_id ? cats.get(cat.parent_id) : undefined;
      return {
        id: t.id, name: t.name, slug: t.slug, logo_url: t.logo_url, cover_image_url: t.cover_image_url,
        description: t.description, avg_rating: t.avg_rating, review_count: t.review_count,
        category: parent?.name ?? cat?.name ?? null,
        subcategory: parent ? cat?.name ?? null : null,
        points: points.get(t.id) ?? [],
      };
    });
}

/** Bookings created in the last 30 days per business (cancelled ones excluded). */
export async function loadBookings30d(db: Db, tenantIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  for (const part of chunk(tenantIds, 150)) {
    const { data } = await db.from('appointments').select('tenant_id').in('tenant_id', part).gte('created_at', since).neq('status', 'cancelled').limit(10000);
    for (const a of (data ?? []) as { tenant_id: string }[]) out.set(a.tenant_id, (out.get(a.tenant_id) ?? 0) + 1);
  }
  return out;
}
