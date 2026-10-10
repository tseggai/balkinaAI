import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';

const bulkSchema = z.object({
  enabled: z.boolean(),
  segment: z.enum(['tenant', 'property']).optional(),
  countries: z.array(z.string().length(2)).max(50).optional(),
  cities: z.array(z.string().min(1).max(80)).max(200).optional(),
  verticals: z.array(z.string().min(1).max(60)).max(100).optional(),
});

// PATCH /api/admin/growth/targets/bulk — enable/disable every target matching the filters.
// Filters combine with AND; an omitted or empty filter matches everything.
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { enabled, segment, countries, cities, verticals } = parsed.data;

  let query = auth.supabase.from('growth_search_targets').update({ enabled }).neq('enabled', enabled);
  if (segment) query = query.eq('segment', segment);
  if (countries?.length) query = query.in('country', countries.map((c) => c.toLowerCase()));
  if (cities?.length) query = query.in('city', cities);
  if (verticals?.length) query = query.in('vertical', verticals);

  const { data, error } = await query.select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, updated: data?.length ?? 0 });
}
