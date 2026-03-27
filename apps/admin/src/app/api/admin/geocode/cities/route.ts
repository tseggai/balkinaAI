import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

// Returns city suggestions for a given query, scoped to a country
// Uses Google Places Autocomplete API (server-side)
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const country = searchParams.get('country'); // ISO 3166-1 alpha-2 code (e.g. "fr", "us")

  if (!query || query.length < 2) {
    return NextResponse.json({ cities: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      input: query,
      types: '(cities)',
      key: apiKey,
    });
    if (country) {
      params.set('components', `country:${country}`);
    }

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    );
    const json = await res.json() as {
      status: string;
      predictions?: { description: string; structured_formatting?: { main_text: string; secondary_text?: string } }[];
    };

    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      return NextResponse.json({ cities: [], error: json.status });
    }

    const cities = (json.predictions ?? []).map(p => ({
      name: p.structured_formatting?.main_text ?? p.description.split(',')[0]?.trim() ?? p.description,
      full: p.description,
    }));

    return NextResponse.json({ cities });
  } catch {
    return NextResponse.json({ cities: [] });
  }
}
