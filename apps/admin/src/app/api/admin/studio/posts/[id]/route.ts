import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { igCredentials } from '@/lib/ig/publish';
import { publishPost, renderPost, type StudioPost } from '@/lib/ig/studio';

export const maxDuration = 300;

const Patch = z.object({
  action: z.enum(['schedule', 'unschedule', 'cancel', 'publish', 'rerender', 'update']),
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

// PATCH /api/admin/studio/posts/[id] — schedule / unschedule / cancel / publish now / re-render / edit caption+kinds.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Patch.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  const post = await load(auth.supabase, params.id);
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  const b = parsed.data;
  const now = new Date().toISOString();
  const db = auth.supabase.from('ig_posts');

  try {
    switch (b.action) {
      case 'update': {
        const { data } = await db.update({ caption: b.caption ?? post.caption, kinds: b.kinds ?? post.kinds, copy: b.copy ?? post.copy, photo_url: b.photo_url ?? post.photo_url, updated_at: now }).eq('id', post.id).select('*').single();
        return NextResponse.json({ post: data });
      }
      case 'rerender': {
        const base = { ...post, copy: b.copy ?? post.copy, photo_url: b.photo_url ?? post.photo_url, caption: b.caption ?? post.caption };
        await db.update({ copy: base.copy, photo_url: base.photo_url, caption: base.caption, error: null, updated_at: now }).eq('id', post.id);
        const rendered = await renderPost(auth.supabase, base);
        return NextResponse.json({ post: rendered });
      }
      case 'schedule': {
        if (!b.scheduled_at) return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 });
        if (!post.render_sq_url) return NextResponse.json({ error: 'Render the post before scheduling it' }, { status: 400 });
        if (post.status === 'published') return NextResponse.json({ error: 'Already published' }, { status: 400 });
        const { data } = await db.update({ status: 'scheduled', scheduled_at: b.scheduled_at, kinds: b.kinds ?? post.kinds, caption: b.caption ?? post.caption, error: null, attempts: 0, attempted_at: null, updated_at: now }).eq('id', post.id).select('*').single();
        return NextResponse.json({ post: data });
      }
      case 'unschedule': {
        const { data } = await db.update({ status: 'draft', scheduled_at: null, updated_at: now }).eq('id', post.id).select('*').single();
        return NextResponse.json({ post: data });
      }
      case 'cancel': {
        const { data } = await db.update({ status: 'cancelled', updated_at: now }).eq('id', post.id).select('*').single();
        return NextResponse.json({ post: data });
      }
      case 'publish': {
        const creds = igCredentials();
        if (!creds) return NextResponse.json({ error: 'META_IG_ACCESS_TOKEN is not set in this deployment' }, { status: 500 });
        if (!post.render_sq_url) return NextResponse.json({ error: 'Render the post before publishing it' }, { status: 400 });
        const target = { ...post, kinds: b.kinds ?? post.kinds, caption: b.caption ?? post.caption };
        await db.update({ kinds: target.kinds, caption: target.caption, updated_at: now }).eq('id', post.id);
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
