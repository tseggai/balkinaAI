import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { resolveIgCredentials } from '@/lib/ig/publish';
import { clearRenders, generateCopy, pendingRenders, publishPost, renderOne, templatesFor, textFieldsOf, type StudioPost } from '@/lib/ig/studio';

export const maxDuration = 60;

const Patch = z.object({
  action: z.enum(['write', 'render', 'rerender', 'update', 'schedule', 'unschedule', 'cancel', 'publish']),
  format: z.enum(['sq', 'st']).optional(),
  lang: z.enum(['sr', 'en', 'base']).optional(),   // 'base' = text-free render of the template with the photo (editable preview)
  langs: z.array(z.enum(['sr', 'en'])).min(1).optional(),
  primary: z.enum(['sr', 'en']).optional(),
  scheduled_at: z.string().datetime().optional(),
  kinds: z.array(z.enum(['feed', 'story'])).min(1).optional(),
  caption: z.string().max(2200).optional(),
  copy: z.record(z.enum(['sr', 'en']), z.record(z.string(), z.string())).optional(),
  photo_url: z.string().url().optional(),
});

async function load(supabase: SupabaseClient, id: string): Promise<StudioPost | null> {
  const { data } = await supabase.from('ig_posts').select('*').eq('id', id).maybeSingle();
  return (data as StudioPost | null) ?? null;
}

/**
 * PATCH /api/admin/studio/posts/[id]
 * write      → GPT-4o-mini copy for the post's own audience/tone/layout (also returns `pending` render steps)
 * render     → one format × language (≈20–40 s); omit format/lang to run the next pending step
 * rerender   → store new copy/photo and forget the renders (then call render per step)
 * update     → caption / kinds / langs / primary language without touching renders
 * schedule   → status scheduled at `scheduled_at` (needs the primary square render)
 * unschedule → back to draft · cancel · publish (now; feed carousel + one story per language)
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Patch.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  const post = await load(auth.supabase, params.id);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  const b = parsed.data;
  const now = new Date().toISOString();
  const db = () => auth.supabase.from('ig_posts');

  try {
    switch (b.action) {
      case 'write': {
        const { sq, st } = await templatesFor(auth.supabase, post.layout);
        if (!sq) return NextResponse.json({ error: `No square template synced for layout "${post.layout}"` }, { status: 400 });
        const r = await generateCopy({ vertical: post.vertical, tone: post.tone, layout: post.layout, fields: textFieldsOf(sq, st), brief: post.brief ?? undefined, langs: post.langs });
        const next = await clearRenders(auth.supabase, post, { copy: r.copy, caption: r.caption });
        return NextResponse.json({ post: next, pending: pendingRenders(next, { sq: true, st: Boolean(st) }) });
      }
      case 'render': {
        const { sq, st } = await templatesFor(auth.supabase, post.layout);
        const has = { sq: Boolean(sq), st: Boolean(st) };
        const pending = pendingRenders(post, has);
        const step = b.format && b.lang ? { format: b.format, lang: b.lang } : pending[0];
        if (!step) return NextResponse.json({ post, pending: [] });
        const next = await renderOne(auth.supabase, post, step);
        return NextResponse.json({ post: next, step, pending: pendingRenders(next, has) });
      }
      case 'rerender': {
        const next = await clearRenders(auth.supabase, post, { copy: b.copy ?? post.copy, photo_url: b.photo_url ?? post.photo_url, caption: b.caption ?? post.caption, ...(b.langs ? { langs: b.langs } : {}), ...(b.primary ? { lang: b.primary } : {}) });
        const { sq, st } = await templatesFor(auth.supabase, post.layout);
        return NextResponse.json({ post: next, pending: pendingRenders(next, { sq: Boolean(sq), st: Boolean(st) }) });
      }
      case 'update': {
        const { data } = await db().update({ caption: b.caption ?? post.caption, kinds: b.kinds ?? post.kinds, langs: b.langs ?? post.langs, lang: b.primary ?? post.lang, updated_at: now }).eq('id', post.id).select('*').single();
        return NextResponse.json({ post: data });
      }
      case 'schedule': {
        if (!b.scheduled_at) return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 });
        if (!post.renders.sq?.[post.lang]) return NextResponse.json({ error: 'Render the post before scheduling it' }, { status: 400 });
        if (post.status === 'published') return NextResponse.json({ error: 'Already published' }, { status: 400 });
        const { data } = await db().update({ status: 'scheduled', scheduled_at: b.scheduled_at, kinds: b.kinds ?? post.kinds, caption: b.caption ?? post.caption, error: null, attempts: 0, attempted_at: null, updated_at: now }).eq('id', post.id).select('*').single();
        return NextResponse.json({ post: data });
      }
      case 'unschedule': {
        const { data } = await db().update({ status: 'draft', scheduled_at: null, updated_at: now }).eq('id', post.id).select('*').single();
        return NextResponse.json({ post: data });
      }
      case 'cancel': {
        const { data } = await db().update({ status: 'cancelled', updated_at: now }).eq('id', post.id).select('*').single();
        return NextResponse.json({ post: data });
      }
      case 'publish': {
        const creds = (await resolveIgCredentials(auth.supabase)).creds;
        if (!creds) return NextResponse.json({ error: 'No Instagram token: paste one on the Instagram page' }, { status: 500 });
        if (!post.renders.sq?.[post.lang]) return NextResponse.json({ error: 'Render the post before publishing it' }, { status: 400 });
        const target = { ...post, kinds: b.kinds ?? post.kinds, caption: b.caption ?? post.caption };
        await db().update({ kinds: target.kinds, caption: target.caption, updated_at: now }).eq('id', post.id);
        const r = await publishPost(auth.supabase, creds, target, target.kinds);
        return NextResponse.json(r);
      }
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// DELETE /api/admin/studio/posts/[id] — remove a post that has not been published.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const post = await load(auth.supabase, params.id);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  if (post.feed_media_id || post.story_media_id) return NextResponse.json({ error: 'Published posts stay in the log; cancel it instead' }, { status: 400 });
  const { error } = await auth.supabase.from('ig_posts').delete().eq('id', post.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
