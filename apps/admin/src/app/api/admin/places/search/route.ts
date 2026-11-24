import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { findLocations } from '@/lib/geo-search';
import { PlacesError } from '@/lib/growth/places';

const Query = z.object({ q: z.string().trim().min(3).max(120) });

// GET /api/admin/places/search?q= — find a location by name or address (Google) to centre a place on.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Query.safeParse({ q: new URL(request.url).searchParams.get('q') ?? '' });
  if (!parsed.success) return NextResponse.json({ error: 'Type at least three characters' }, { status: 400 });
  try {
    return NextResponse.json({ results: await findLocations(parsed.data.q) });
  } catch (err) {
    const status = err instanceof PlacesError && err.status >= 400 && err.status < 600 ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: status === 403 ? 502 : status });
  }
}
