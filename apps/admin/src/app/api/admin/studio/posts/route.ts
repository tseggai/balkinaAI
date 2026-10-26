import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { renderPost, type StudioPost } from '@/lib/ig/studio';

export const maxDuration = 300;

const Body = z.object({
  vertical: z.string().min(1),
  tone: z.string().min(1),
  lang: z.enum(['sr', 'en']),
  layout: z.string().min(1),
  brief: z.string().max(1000).optional(),
  copy: z.record(z.enum(['sr', 'en']), z.record(z.string(), z.string())),
  caption: z.string().max(2200).optional(),
  photo_url: z.string().url(),
  kinds: z.array(z.enum(['feed', 'story'])).min(1).default(['feed', 'story']),
});

// POST /api/admin/studio/posts — create a draft and render its square (+ story) through Canva.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  if (!b.copy[b.lang]) return NextResponse.json({ error: `No copy for language "${b.lang}"` }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('ig_posts')
    .insert({ vertical: b.vertical, tone: b.tone, lang: b.lang, layout: b.layout, brief: b.brief ?? null, copy: b.copy, caption: b.caption ?? null, photo_url: b.photo_url, kinds: b.kinds })
    .select('*')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });

  try {
    const post = await renderPost(auth.supabase, data as StudioPost);
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await auth.supabase.from('ig_posts').update({ error: message, updated_at: new Date().toISOString() }).eq('id', (data as StudioPost).id);
    return NextResponse.json({ error: message, post: { ...(data as StudioPost), error: message } }, { status: 500 });
  }
}
