import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GROWTH_PROSPECT_STAGES } from '@balkina/shared';
import { requireAdmin } from '@/lib/admin-auth';

const PAGE_SIZE = 50;

// GET /api/admin/growth/prospects?segment=&stage=&vertical=&country=&city=&min_score=&q=&page=
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { searchParams } = new URL(request.url);
  const segment = searchParams.get('segment');
  const stage = searchParams.get('stage');
  const vertical = searchParams.get('vertical');
  const country = searchParams.get('country');
  const city = searchParams.get('city');
  const minScore = Number(searchParams.get('min_score') ?? '');
  // PostgREST `or` filters are comma/paren delimited — strip those from free text.
  const q = searchParams.get('q')?.replace(/[,()]/g, ' ').trim().slice(0, 100);
  const hasEmail = searchParams.get('has_email');
  const built = searchParams.get('built'); // 'yes' | 'no'
  const enriched = searchParams.get('enriched'); // 'yes' | 'no'
  const dueBefore = searchParams.get('due_before'); // ISO: follow-up queue (next_follow_up_at <= value)
  const activity = searchParams.get('activity'); // 'viewed' | 'tested' | 'untouched'
  const sort = searchParams.get('sort') ?? 'score'; // 'score' | 'activity' | 'due'
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  let query = auth.supabase.from('growth_prospects').select('*', { count: 'exact' });
  if (sort === 'activity') query = query.order('last_activity_at', { ascending: false, nullsFirst: false });
  else if (sort === 'due') query = query.order('next_follow_up_at', { ascending: true, nullsFirst: false });
  query = query
    .order('icp_score', { ascending: false })
    .order('google_review_count', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (segment && segment !== 'all') query = query.eq('segment', segment);
  if (stage && stage !== 'all') query = query.eq('stage', stage);
  if (vertical && vertical !== 'all') query = query.eq('vertical', vertical);
  if (country && country !== 'all') query = query.eq('country', country);
  if (city && city !== 'all') query = query.eq('city', city);
  if (Number.isFinite(minScore) && searchParams.get('min_score')) query = query.gte('icp_score', minScore);
  if (q) query = query.or(`name.ilike.%${q}%,website.ilike.%${q}%,instagram.ilike.%${q}%`);
  if (hasEmail === 'yes') query = query.not('email', 'is', null);
  if (hasEmail === 'no') query = query.is('email', null);
  if (built === 'yes') query = query.not('tenant_id', 'is', null);
  if (built === 'no') query = query.is('tenant_id', null);
  if (enriched === 'yes') query = query.not('enriched_at', 'is', null);
  if (enriched === 'no') query = query.is('enriched_at', null);
  if (dueBefore && !Number.isNaN(Date.parse(dueBefore))) query = query.lte('next_follow_up_at', dueBefore);
  if (activity === 'viewed') query = query.gt('page_views', 0);
  if (activity === 'tested') query = query.not('demo_completed_at', 'is', null);
  if (activity === 'untouched') query = query.eq('touches', 0);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count: count ?? 0, page, page_size: PAGE_SIZE });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(GROWTH_PROSPECT_STAGES as [string, ...string[]]).optional(),
  notes: z.string().max(5000).nullable().optional(),
  email: z.string().email().nullable().optional(),
  instagram: z.string().max(100).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  icp_score: z.number().int().min(-10).max(20).optional(),
  next_follow_up_at: z.string().datetime({ offset: true }).nullable().optional(),
});

// PATCH /api/admin/growth/prospects — update stage / notes / contact facts
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { id, ...updates } = parsed.data;
  const { error } = await auth.supabase
    .from('growth_prospects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/admin/growth/prospects?id=
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await auth.supabase.from('growth_prospects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
