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

/**
 * Runs one text search and follows nextPageToken up to `maxPages` times
 * (20 results per page, so 3 pages = up to 60 businesses per query).
 */
export async function searchPlaces(opts: {
  textQuery: string;
  languageCode: string;
  regionCode: string;
  maxPages?: number;
}): Promise<{ places: PlaceResult[]; requests: number }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new PlacesError('GOOGLE_MAPS_API_KEY is not configured', 500);

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
          ? ' — enable "Places API (New)" for this key in Google Cloud Console.'
          : '';
      throw new PlacesError(msg + hint, res.status);
    }

    for (const raw of json.places ?? []) places.push(normalisePlace(raw));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return { places, requests };
}
