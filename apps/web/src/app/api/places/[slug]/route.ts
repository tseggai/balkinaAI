/**
 * GET /api/places/:slug — one published place with its businesses, in the shape the storefront
 * renders (the same tenant fields /api/properties returns). Businesses are the claimed ones located
 * inside the place boundary; there is no owner, no campaigns and no membership.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isPlaceVisible, type PlaceRow } from '@balkina/shared';
import { placeMembers } from '@/lib/places';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const supabase = createAdminClient();
  const { data } = await supabase.from('places').select('*').eq('slug', params.slug).maybeSingle();
  const place = data as PlaceRow | null;
  if (!place || !isPlaceVisible(place)) return NextResponse.json({ error: 'Place not found' }, { status: 404, headers: CORS_HEADERS });

  const members = await placeMembers(supabase, place);
  const tenants = members
    .sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0) || a.name.localeCompare(b.name))
    .map((m) => ({
      id: m.id, name: m.name, slug: m.slug, logo_url: m.logo_url, cover_image_url: m.cover_image_url,
      description: m.description, avg_rating: m.avg_rating, review_count: m.review_count,
      category: m.category, subcategory: m.subcategory, featured: false,
    }));

  return NextResponse.json({
    place: { id: place.id, slug: place.slug, name: place.name, tagline: place.tagline, photo_url: place.photo_url, lat: place.lat, lng: place.lng },
    tenants,
    // Shown on every place surface: the place is a location, not a partner.
    notice: 'Independent businesses. Not affiliated with the property owner.',
  }, { headers: CORS_HEADERS });
}
