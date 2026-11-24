import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { placeSlug, refreshPlaces } from '@/lib/places';

export const maxDuration = 60;

const Body = z.object({
  name: z.string().trim().min(2).max(60),
  refers_to: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(140).optional(),
  photo_url: z.string().url().max(500).optional().or(z.literal('')),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_km: z.number().positive().max(25),
  need_total: z.number().int().min(1).max(500),
  need_dining: z.number().int().min(0).max(200),
  need_care: z.number().int().min(0).max(200),
  need_active: z.number().int().min(0).max(200),
  status: z.enum(['draft', 'watching']).default('watching'),
});

// GET /api/admin/places — every place measured from the live data, plus candidate clusters.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  try {
    return NextResponse.json(await refreshPlaces(auth.supabase));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// POST /api/admin/places — draw a new place. It starts unpublished (draft or watching).
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid place', issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  const base = placeSlug(b.name);
  if (!base) return NextResponse.json({ error: 'The name needs at least one letter or digit' }, { status: 400 });
  const { data: taken } = await auth.supabase.from('places').select('slug').like('slug', `${base}%`);
  const slugs = new Set(((taken ?? []) as { slug: string }[]).map((r) => r.slug));
  let slug = base;
  for (let i = 2; slugs.has(slug); i++) slug = `${base}-${i}`;

  const { data, error } = await auth.supabase
    .from('places')
    .insert({ ...b, slug, refers_to: b.refers_to || null, tagline: b.tagline || null, photo_url: b.photo_url || null })
    .select('id')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id, slug });
}
