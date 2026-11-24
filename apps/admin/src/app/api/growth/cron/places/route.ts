import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { refreshPlaces } from '@/lib/places';

export const maxDuration = 120;

/**
 * POST /api/growth/cron/places
 * Daily refresh of the places (docs/PLACES.md): measures every place, stores the density, hides a
 * published place that thinned out below 70% of its thresholds (and shows it again at 100%), and
 * stamps the first time a place reaches Level 1 or Level 2.
 * Auth: `Authorization: Bearer <GROWTH_CRON_SECRET>` (also accepts Vercel's CRON_SECRET).
 */
export async function POST(request: Request) {
  const secret = process.env.GROWTH_CRON_SECRET ?? process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const report = await refreshPlaces(createAdminClient());
    return NextResponse.json({
      missingTable: report.missingTable,
      reached: report.reached,
      places: report.places.map((p) => ({ name: p.name, status: p.status, hidden: p.hidden, ...p.fresh })),
      candidates: report.candidates.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Places refresh failed' }, { status: 500 });
  }
}

// Vercel Cron calls with GET.
export const GET = POST;
