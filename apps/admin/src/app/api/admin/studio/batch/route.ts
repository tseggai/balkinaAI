import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { batchSlots, categoryOf, listPhotos, pickPhoto } from '@/lib/ig/studio';

const Body = z.object({
  count: z.number().int().min(1).max(40),
  verticals: z.array(z.string().min(1)).min(1),
  tones: z.array(z.string().min(1)).min(1),
  layouts: z.array(z.string().min(1)).optional(),   // omitted = each post uses its audience's category template
  lang: z.enum(['sr', 'en']).default('sr'),
  langs: z.array(z.enum(['sr', 'en'])).min(1).default(['sr', 'en']),
  kinds: z.array(z.enum(['feed', 'story'])).min(1).default(['feed', 'story']),
  brief: z.string().max(1000).optional(),
  photos: z.array(z.string().url()).optional(),   // restrict the photo pool; default = everything in the library
  cadence: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    post_time: z.string().regex(/^\d{2}:\d{2}$/),
    days: z.array(z.number().int().min(1).max(7)).min(1),
    timezone: z.string().min(1),
    per_day: z.number().int().min(1).max(6).optional(),
    gap_minutes: z.number().int().min(15).max(720).optional(),
  }),
});

/**
 * POST /api/admin/studio/batch — create `count` drafts rotating through the chosen audiences, tones and
 * layouts, each with a photo from the library and a posting slot on the cadence (slots already used by
 * scheduled studio posts are skipped). Copy and renders run afterwards per post from the browser:
 * PATCH { action: 'write' } then PATCH { action: 'render' } until `pending` is empty, then schedule.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  const langs = b.langs.includes(b.lang) ? b.langs : [b.lang, ...b.langs];

  const [pool, takenRes, tplRes] = await Promise.all([
    listPhotos(auth.supabase),
    auth.supabase.from('ig_posts').select('scheduled_at').eq('status', 'scheduled').not('scheduled_at', 'is', null),
    auth.supabase.from('ig_templates').select('layout').eq('format', 'sq'),
  ]);
  const photos = b.photos?.length ? pool.filter((p) => b.photos?.includes(p.url)) : pool;
  if (photos.length === 0) return NextResponse.json({ error: 'No photos in the library' }, { status: 400 });
  const synced = new Set(((tplRes.data ?? []) as { layout: string }[]).map((t) => t.layout));
  const explicit = (b.layouts ?? []).filter((l) => synced.has(l));
  if (synced.size === 0) return NextResponse.json({ error: 'No square templates synced yet' }, { status: 400 });
  // Audiences whose category has no template yet fall back to the explicit list, then to any synced template.
  const layoutFor = (vertical: string, i: number): string => {
    const cat = categoryOf(vertical);
    if (synced.has(cat) && explicit.length === 0) return cat;
    if (explicit.length) return explicit[i % explicit.length] ?? cat;
    return Array.from(synced)[i % synced.size] ?? cat;
  };
  const taken = new Set(((takenRes.data ?? []) as { scheduled_at: string }[]).map((r) => r.scheduled_at));
  const slots = batchSlots(b.cadence, b.count, taken);
  const batch_id = randomUUID();

  const rows = Array.from({ length: b.count }, (_, i) => {
    const vertical = b.verticals[i % b.verticals.length] ?? b.verticals[0] ?? 'all';
    const photo = pickPhoto(photos, vertical, Math.floor(i / b.verticals.length) + i);
    return {
      batch_id,
      status: 'draft',
      vertical,
      tone: b.tones[i % b.tones.length],
      layout: layoutFor(vertical, i),
      lang: b.lang,
      langs,
      kinds: b.kinds,
      brief: b.brief ?? null,
      copy: {},
      photo_url: photo?.url ?? photos[0]?.url ?? '',
      scheduled_at: slots[i] ?? null,
    };
  });
  const { data, error } = await auth.supabase.from('ig_posts').insert(rows).select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch_id, posts: data ?? [] });
}
