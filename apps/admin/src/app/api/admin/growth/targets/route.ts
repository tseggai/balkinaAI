import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/growth/targets — the vertical × city search matrix
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { data, error } = await auth.supabase
    .from('growth_search_targets')
    .select('*')
    .order('country')
    .order('city')
    .order('priority')
    .order('vertical');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

const createSchema = z.object({
  segment: z.enum(['tenant', 'property']).default('tenant'),
  vertical: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/, 'vertical must be snake_case'),
  query: z.string().min(2).max(120),
  city: z.string().min(1).max(80),
  country: z.string().length(2).transform((s) => s.toLowerCase()),
  language: z.string().min(2).max(5).default('sr'),
  priority: z.number().int().min(1).max(9).default(5),
});

// POST /api/admin/growth/targets — add one target
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('growth_search_targets')
    .insert(parsed.data)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(1).max(9).optional(),
  query: z.string().min(2).max(120).optional(),
});

// PATCH /api/admin/growth/targets — toggle / reprioritise / edit query
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { id, ...updates } = parsed.data;
  const { error } = await auth.supabase.from('growth_search_targets').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/admin/growth/targets?id=
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await auth.supabase.from('growth_search_targets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
