import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * GET /api/admin/growth/prospects/facets
 * Distinct filter values with counts for the Prospects page (stages, countries,
 * cities per country, verticals) plus a few funnel totals.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { data, error } = await auth.supabase
    .from('growth_prospects')
    .select('segment, stage, country, city, vertical, icp_score, email, enriched_at, tenant_id, claimed_at, last_contacted_at, touches, page_viewed_at, demo_completed_at, next_follow_up_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as {
    segment: string; stage: string; country: string | null; city: string | null; vertical: string | null;
    icp_score: number; email: string | null; enriched_at: string | null; tenant_id: string | null;
    claimed_at: string | null; last_contacted_at: string | null; touches: number;
    page_viewed_at: string | null; demo_completed_at: string | null; next_follow_up_at: string | null;
  }[];
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const bump = (map: Record<string, number>, key: string | null | undefined) => {
    const k = key ?? 'unknown';
    map[k] = (map[k] ?? 0) + 1;
  };

  const stages: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const cities: Record<string, Record<string, number>> = {};
  const verticals: Record<string, number> = {};
  const segments: Record<string, number> = {};
  let withEmail = 0, enriched = 0, pagesBuilt = 0, claimed = 0, contacted = 0, highScore = 0;
  let viewed = 0, tested = 0, due = 0;

  for (const r of rows) {
    bump(stages, r.stage);
    bump(countries, r.country);
    bump(verticals, r.vertical);
    bump(segments, r.segment);
    const c = r.country ?? 'unknown';
    cities[c] ??= {};
    bump(cities[c], r.city);
    if (r.email) withEmail++;
    if (r.enriched_at) enriched++;
    if (r.tenant_id) pagesBuilt++;
    if (r.claimed_at) claimed++;
    if (r.last_contacted_at || r.touches > 0) contacted++;
    if (r.icp_score >= 4) highScore++;
    if (r.page_viewed_at) viewed++;
    if (r.demo_completed_at) tested++;
    if (r.next_follow_up_at && new Date(r.next_follow_up_at) <= endOfToday && !r.claimed_at) due++;
  }

  return NextResponse.json({
    total: rows.length,
    segments,
    stages,
    countries,
    cities,
    verticals,
    totals: { withEmail, enriched, pagesBuilt, claimed, contacted, highScore, viewed, tested, due },
  });
}
