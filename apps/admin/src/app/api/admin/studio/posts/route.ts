import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { listPhotos, pickPhoto } from '@/lib/ig/studio';

const Body = z.object({
  vertical: z.string().min(1),
  tone: z.string().min(1),
  lang: z.enum(['sr', 'en']),
  langs: z.array(z.enum(['sr', 'en'])).min(1).default(['sr', 'en']),
  layout: z.string().min(1),
  brief: z.string().max(1000).optional(),
  copy: z.record(z.enum(['sr', 'en']), z.record(z.string(), z.string())),
  caption: z.string().max(2200).optional(),
  photo_url: z.string().url().optional(),   // omitted = a library photo matched to the audience
  kinds: z.array(z.enum(['feed', 'story'])).min(1).default(['feed', 'story']),
});

// POST /api/admin/studio/posts — create a draft. Renders run afterwards, one step per PATCH { action: 'render' }.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  if (!b.copy[b.lang]) return NextResponse.json({ error: `No copy for language "${b.lang}"` }, { status: 400 });
  const langs = b.langs.includes(b.lang) ? b.langs : [b.lang, ...b.langs];
  const photo_url = b.photo_url ?? pickPhoto(await listPhotos(auth.supabase), b.vertical, Date.now() % 13)?.url;
  if (!photo_url) return NextResponse.json({ error: 'No photos in the library' }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('ig_posts')
    .insert({ vertical: b.vertical, tone: b.tone, lang: b.lang, langs, layout: b.layout, brief: b.brief ?? null, copy: b.copy, caption: b.caption ?? null, photo_url, kinds: b.kinds })
    .select('*')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  return NextResponse.json({ post: data });
}
