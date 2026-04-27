import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400, headers: CORS_HEADERS });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500, headers: CORS_HEADERS });

  try {
    // Geocode address
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );
    const geoJson = await geoRes.json() as {
      status: string;
      results?: {
        formatted_address?: string;
        geometry?: { location?: { lat: number; lng: number } };
        address_components?: { long_name: string; short_name: string; types: string[] }[];
      }[];
    };

    if (geoJson.status !== 'OK' || !geoJson.results?.[0]) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const result = geoJson.results[0];
    const lat = result.geometry?.location?.lat ?? null;
    const lng = result.geometry?.location?.lng ?? null;

    // Parse address components
    let city = '', state = '', country = '', postalCode = '', streetAddress = '';
    let streetNum = '', route = '';
    for (const comp of result.address_components ?? []) {
      const t = comp.types;
      if (t.includes('street_number')) streetNum = comp.long_name;
      else if (t.includes('route')) route = comp.long_name;
      else if (t.includes('locality') || t.includes('postal_town')) city = comp.long_name;
      else if (t.includes('administrative_area_level_1')) state = comp.short_name;
      else if (t.includes('country')) country = comp.long_name;
      else if (t.includes('postal_code')) postalCode = comp.long_name;
    }
    if (streetNum || route) streetAddress = [streetNum, route].filter(Boolean).join(' ');

    // Get timezone
    let timezone = 'UTC';
    if (lat && lng) {
      const tzRes = await fetch(
        `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${apiKey}`
      );
      const tzJson = await tzRes.json() as { status: string; timeZoneId?: string };
      if (tzJson.status === 'OK' && tzJson.timeZoneId) timezone = tzJson.timeZoneId;
    }

    return NextResponse.json({
      formatted_address: result.formatted_address ?? address,
      street_address: streetAddress,
      city, state, country, postal_code: postalCode,
      latitude: lat, longitude: lng,
      timezone,
    }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500, headers: CORS_HEADERS });
  }
}
