import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GROWTH_VERTICALS, getGrowthCountry } from '@balkina/shared';
import { requireAdmin } from '@/lib/admin-auth';

const MAX_COMBOS = 60;

const bodySchema = z.object({
  segment: z.enum(['tenant', 'property']).default('tenant'),
  cities: z.array(z.object({ city: z.string().min(1).max(80), country: z.string().length(2) })).min(1).max(40),
  verticals: z.array(z.string().min(1).max(60)).min(1).max(30),
});

/**
 * POST /api/admin/growth/generate
 * Step 1 of "Generate prospects": turns the chosen cities × business types into
 * search targets (upserted, so re-running the same combo refreshes rather than
 * duplicates) and returns their ids. The client then runs the prospector over
 * those ids in small chunks and enriches the results.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }
  const { segment, cities, verticals } = parsed.data;

  const rows: { segment: string; vertical: string; query: string; city: string; country: string; language: string; enabled: boolean; priority: number }[] = [];
  for (const { city, country } of cities) {
    const c = getGrowthCountry(country);
    const lang = c?.language ?? 'sr';
    for (const key of verticals) {
      const v = GROWTH_VERTICALS.find((x) => x.key === key);
      const query = v ? v.query[lang] : key.replace(/_/g, ' ');
      rows.push({ segment, vertical: key, query, city, country: country.toLowerCase(), language: lang, enabled: true, priority: v?.tier ?? 5 });
    }
  }
  if (rows.length > MAX_COMBOS) {
    return NextResponse.json({ error: `Too many combinations (${rows.length}); pick fewer cities or business types (max ${MAX_COMBOS}).` }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('growth_search_targets')
    .upsert(rows, { onConflict: 'segment,vertical,city,country' })
    .select('id, vertical, city, country, query');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ targets: data ?? [] });
}
