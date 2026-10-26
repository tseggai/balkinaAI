import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { igConfig } from '@/lib/ig/runner';
import { STOCK_PHOTOS, TONES, VERTICALS } from '@/lib/ig/studio';

// GET /api/admin/studio — catalogue (verticals, tones, stock photos), synced layouts and the latest posts.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const [tplRes, postRes, canvaRes] = await Promise.all([
    auth.supabase.from('ig_templates').select('id, layout, format, fields, thumbnail_url, last_render_url').order('title'),
    auth.supabase.from('ig_posts').select('*').order('created_at', { ascending: false }).limit(60),
    auth.supabase.from('canva_connection').select('connected_at').eq('id', 1).maybeSingle(),
  ]);
  const templates = (tplRes.data ?? []) as { id: string; layout: string; format: 'sq' | 'st'; fields: Record<string, string>; thumbnail_url: string | null; last_render_url: string | null }[];
  const layouts = Array.from(new Set(templates.map((t) => t.layout))).map((layout) => {
    const sq = templates.find((t) => t.layout === layout && t.format === 'sq') ?? null;
    const st = templates.find((t) => t.layout === layout && t.format === 'st') ?? null;
    const fields = Array.from(new Set([...Object.entries(sq?.fields ?? {}), ...Object.entries(st?.fields ?? {})].filter(([, v]) => v === 'text').map(([k]) => k)));
    return { layout, sq: Boolean(sq), st: Boolean(st), fields, preview: sq?.last_render_url ?? sq?.thumbnail_url ?? st?.thumbnail_url ?? null };
  }).filter((l) => l.sq);
  return NextResponse.json({
    verticals: VERTICALS,
    tones: TONES,
    photos: STOCK_PHOTOS,
    layouts,
    posts: postRes.data ?? [],
    canva: Boolean(canvaRes.data),
    openai: Boolean(process.env.OPENAI_API_KEY),
    instagram: igConfig().credentials,
  });
}
