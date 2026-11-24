/**
 * GET /api/places?lat=&lng= — the place cards for the home screen: published places within reach of
 * the user, nearest first (all published ones when no position is given). Empty until a place is
 * published, which keeps the home screen as it was.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { nearbyPlaces, visiblePlaces } from '@/lib/places';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = Query.safeParse({ lat: searchParams.get('lat') ?? undefined, lng: searchParams.get('lng') ?? undefined });
  const at = parsed.success && parsed.data.lat !== undefined && parsed.data.lng !== undefined ? { lat: parsed.data.lat, lng: parsed.data.lng } : null;
  const places = await visiblePlaces(createAdminClient());
  return NextResponse.json({ places: nearbyPlaces(places, at) }, { headers: CORS_HEADERS });
}
