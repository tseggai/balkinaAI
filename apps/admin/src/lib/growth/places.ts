/**
 * Google Places API (New) — Text Search client used by the prospector.
 * Requires "Places API (New)" to be enabled for GOOGLE_MAPS_API_KEY.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null; // lower-case ISO alpha-2
  lat: number | null;
  lng: number | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  primaryType: string | null;
  businessStatus: string | null;
  mapsUrl: string | null;
}

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.googleMapsUri',
  'places.primaryType',
  'places.types',
  'places.businessStatus',
  'places.addressComponents',
  'nextPageToken',
].join(',');

export class PlacesError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'PlacesError';
  }
}

function pickComponent(components: RawPlace['addressComponents'], type: string, short = false): string | null {
  const c = components?.find((x) => x.types?.includes(type));
  if (!c) return null;
  return (short ? c.shortText : c.longText) ?? null;
}

export function normalisePlace(p: RawPlace): PlaceResult {
  const city =
    pickComponent(p.addressComponents, 'locality') ??
    pickComponent(p.addressComponents, 'postal_town') ??
    pickComponent(p.addressComponents, 'administrative_area_level_2') ??
    null;
  const country = pickComponent(p.addressComponents, 'country', true)?.toLowerCase() ?? null;
  return {
    placeId: p.id,
    name: p.displayName?.text?.trim() || '(unnamed)',
    address: p.formattedAddress ?? null,
    city,
    country,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    website: p.websiteUri ?? null,
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviewCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    types: p.types ?? [],
    primaryType: p.primaryType ?? null,
    businessStatus: p.businessStatus ?? null,
    mapsUrl: p.googleMapsUri ?? null,
  };
}

export type PlacesApi = 'new' | 'legacy';

export interface SearchResult {
  places: PlaceResult[];
  requests: number;
  api: PlacesApi;
}

/**
 * Runs one text search and follows the page token up to `maxPages` times
 * (20 results per page, so 3 pages = up to 60 businesses per query).
 *
 * Uses Places API (New) first. If that returns 403 (service not enabled on the
 * project, or the key's API restrictions exclude "Places API (New)"), falls back
 * to the legacy Places API (Text Search + Place Details for website/phone) so a
 * key that only has the legacy "Places API" enabled still works.
 */
export async function searchPlaces(opts: {
  textQuery: string;
  languageCode: string;
  regionCode: string;
  maxPages?: number;
  api?: PlacesApi;
}): Promise<SearchResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new PlacesError('GOOGLE_MAPS_API_KEY is not configured', 500);

  const forced = opts.api ?? (process.env.GROWTH_PLACES_API as PlacesApi | undefined);
  if (forced === 'legacy') return searchPlacesLegacy(apiKey, opts);

  try {
    return await searchPlacesNew(apiKey, opts);
  } catch (err) {
    if (err instanceof PlacesError && err.status === 403 && forced !== 'new') {
      return searchPlacesLegacy(apiKey, opts, err.message);
    }
    throw err;
  }
}

async function searchPlacesNew(
  apiKey: string,
  opts: { textQuery: string; languageCode: string; regionCode: string; maxPages?: number }
): Promise<SearchResult> {
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? 3, 3));
  const places: PlaceResult[] = [];
  let pageToken: string | undefined;
  let requests = 0;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: opts.textQuery,
        languageCode: opts.languageCode,
        regionCode: opts.regionCode.toUpperCase(),
        pageSize: 20,
        ...(pageToken ? { pageToken } : {}),
      }),
    });
    requests++;

    const json = (await res.json().catch(() => ({}))) as {
      places?: RawPlace[];
      nextPageToken?: string;
      error?: { message?: string; status?: string };
    };

    if (!res.ok) {
      const msg = json.error?.message ?? `Places API error ${res.status}`;
      const hint =
        res.status === 403 || /not enabled|API has not been used|PERMISSION_DENIED/i.test(msg)
          ? ' — Places API (New): enable the "Places API (New)" service (separate from "Places API") and add it to the key\'s API restrictions in Google Cloud Console.'
          : '';
      throw new PlacesError(msg + hint, res.status);
    }

    for (const raw of json.places ?? []) places.push(normalisePlace(raw));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return { places, requests, api: 'new' };
}

// ─── Legacy Places API fallback ──────────────────────────────────────────────

interface LegacyTextResult {
  place_id: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
}

interface LegacyDetails {
  website?: string;
  international_phone_number?: string;
  formatted_phone_number?: string;
  url?: string;
  address_components?: { long_name?: string; short_name?: string; types?: string[] }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchPlacesLegacy(
  apiKey: string,
  opts: { textQuery: string; languageCode: string; regionCode: string; maxPages?: number },
  reason?: string
): Promise<SearchResult> {
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? 3, 3));
  const results: LegacyTextResult[] = [];
  let pageToken: string | undefined;
  let requests = 0;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ query: opts.textQuery, language: opts.languageCode, region: opts.regionCode.toLowerCase(), key: apiKey });
    if (pageToken) params.set('pagetoken', pageToken);

    // A legacy next_page_token only becomes valid ~2 s after it is issued.
    let json: { status: string; results?: LegacyTextResult[]; next_page_token?: string; error_message?: string } = { status: 'INVALID_REQUEST' };
    for (let attempt = 0; attempt < 4; attempt++) {
      if (pageToken) await sleep(attempt === 0 ? 2000 : 1500);
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
      requests++;
      json = (await res.json().catch(() => ({ status: 'UNKNOWN_ERROR' }))) as typeof json;
      if (!(pageToken && json.status === 'INVALID_REQUEST')) break;
    }

    if (json.status === 'ZERO_RESULTS') break;
    if (json.status !== 'OK') {
      const prefix = reason ? `Places API (New) failed (${reason}); legacy fallback also failed: ` : 'Legacy Places API: ';
      const status = json.status === 'REQUEST_DENIED' ? 403 : json.status === 'OVER_QUERY_LIMIT' ? 429 : 500;
      throw new PlacesError(`${prefix}${json.status}${json.error_message ? ` — ${json.error_message}` : ''}`, status);
    }

    results.push(...(json.results ?? []));
    pageToken = json.next_page_token;
    if (!pageToken) break;
  }

  // Place Details for website + phone (Contact Data SKU), 5 at a time.
  const details = new Map<string, LegacyDetails>();
  const queue = [...results];
  const worker = async () => {
    while (queue.length) {
      const r = queue.shift();
      if (!r) break;
      const params = new URLSearchParams({
        place_id: r.place_id,
        fields: 'website,international_phone_number,formatted_phone_number,url,address_components',
        language: opts.languageCode,
        key: apiKey,
      });
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
        requests++;
        const json = (await res.json().catch(() => ({}))) as { status?: string; result?: LegacyDetails };
        if (json.status === 'OK' && json.result) details.set(r.place_id, json.result);
      } catch {
        /* keep going: details are best-effort */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, queue.length || 1) }, worker));

  const places: PlaceResult[] = results.map((r) => {
    const d = details.get(r.place_id);
    const comp = d?.address_components?.map((c) => ({ longText: c.long_name, shortText: c.short_name, types: c.types }));
    return normalisePlace({
      id: r.place_id,
      displayName: { text: r.name },
      formattedAddress: r.formatted_address,
      location: { latitude: r.geometry?.location?.lat, longitude: r.geometry?.location?.lng },
      rating: r.rating,
      userRatingCount: r.user_ratings_total,
      websiteUri: d?.website,
      internationalPhoneNumber: d?.international_phone_number,
      nationalPhoneNumber: d?.formatted_phone_number,
      googleMapsUri: d?.url,
      types: r.types,
      businessStatus: r.business_status,
      addressComponents: comp,
    });
  });

  return { places, requests, api: 'legacy' };
}
