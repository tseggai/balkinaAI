/**
 * Location search for the admin (drawing a place): one Google Text Search by name or address,
 * returning a centre and a first guess at the radius. Uses the same key as the prospector
 * (GOOGLE_MAPS_API_KEY), Places API (New) first and the legacy Places API when the key only has that.
 */
import { PlacesError } from '@/lib/growth/places';

export interface GeoResult {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** Half the smaller side of Google's viewport, 0.5 to 5 km. A starting point, not a boundary. */
  radius_km: number | null;
}

interface Corner { lat: number; lng: number }

function radiusFrom(lat: number, low: Corner | null, high: Corner | null): number | null {
  if (!low || !high) return null;
  const height = Math.abs(high.lat - low.lat) * 111.32;
  const width = Math.abs(high.lng - low.lng) * 111.32 * Math.cos((lat * Math.PI) / 180);
  const half = Math.min(height, width) / 2;
  if (!Number.isFinite(half) || half <= 0) return null;
  return Math.min(5, Math.max(0.5, Math.round(half * 10) / 10));
}

async function searchNew(apiKey: string, query: string): Promise<GeoResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.viewport',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 6 }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    places?: {
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      viewport?: { low?: { latitude?: number; longitude?: number }; high?: { latitude?: number; longitude?: number } };
    }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new PlacesError(json.error?.message ?? `Places API error ${res.status}`, res.status);
  const corner = (c?: { latitude?: number; longitude?: number }): Corner | null =>
    typeof c?.latitude === 'number' && typeof c?.longitude === 'number' ? { lat: c.latitude, lng: c.longitude } : null;
  const out: GeoResult[] = [];
  for (const p of json.places ?? []) {
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    out.push({
      id: p.id,
      name: p.displayName?.text?.trim() || p.formattedAddress || 'Unnamed',
      address: p.formattedAddress ?? null,
      lat,
      lng,
      radius_km: radiusFrom(lat, corner(p.viewport?.low), corner(p.viewport?.high)),
    });
  }
  return out;
}

async function searchLegacy(apiKey: string, query: string): Promise<GeoResult[]> {
  const params = new URLSearchParams({ query, key: apiKey });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
  const json = (await res.json().catch(() => ({ status: 'UNKNOWN_ERROR' }))) as {
    status: string;
    error_message?: string;
    results?: {
      place_id: string;
      name?: string;
      formatted_address?: string;
      geometry?: { location?: Partial<Corner>; viewport?: { southwest?: Partial<Corner>; northeast?: Partial<Corner> } };
    }[];
  };
  if (json.status === 'ZERO_RESULTS') return [];
  if (json.status !== 'OK') {
    throw new PlacesError(`${json.status}${json.error_message ? `: ${json.error_message}` : ''}`, json.status === 'REQUEST_DENIED' ? 403 : 500);
  }
  const corner = (c?: Partial<Corner>): Corner | null => (typeof c?.lat === 'number' && typeof c?.lng === 'number' ? { lat: c.lat, lng: c.lng } : null);
  const out: GeoResult[] = [];
  for (const r of (json.results ?? []).slice(0, 6)) {
    const at = corner(r.geometry?.location);
    if (!at) continue;
    out.push({
      id: r.place_id,
      name: r.name?.trim() || r.formatted_address || 'Unnamed',
      address: r.formatted_address ?? null,
      lat: at.lat,
      lng: at.lng,
      radius_km: radiusFrom(at.lat, corner(r.geometry?.viewport?.southwest), corner(r.geometry?.viewport?.northeast)),
    });
  }
  return out;
}

/** Up to six matches for a name or an address, best first. */
export async function findLocations(query: string): Promise<GeoResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new PlacesError('GOOGLE_MAPS_API_KEY is not configured', 500);
  try {
    return await searchNew(apiKey, query);
  } catch (err) {
    // The key may only have the legacy "Places API" enabled.
    if (err instanceof PlacesError && err.status === 403) return searchLegacy(apiKey, query);
    throw err;
  }
}
