import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { igConfig } from '@/lib/ig/runner';
import { loadSettings } from '@/lib/ig/schedule';
import { CATEGORIES, listPhotos, TONES, VERTICALS } from '@/lib/ig/studio';
import { refreshThumbnails, type TemplateThumbRow } from '@/lib/canva/thumbnails';

// GET /api/admin/studio — catalogue (verticals, tones, photo library), synced layouts, plan cadence defaults and the latest posts.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const [tplRes, postRes, canvaRes, photos, settings] = await Promise.all([
    auth.supabase.from('ig_templates').select('id, brand_template_id, layout, format, fields, thumbnail_url, last_render_url').order('title'),
    auth.supabase.from('ig_posts').select('*').order('scheduled_at', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false }).limit(120),
    auth.supabase.from('canva_connection').select('connected_at').eq('id', 1).maybeSingle(),
    listPhotos(auth.supabase),
    loadSettings(auth.supabase),
  ]);
  type Tpl = TemplateThumbRow & { layout: string; format: 'sq' | 'st'; fields: Record<string, string>; last_render_url: string | null };
  const raw = (tplRes.data ?? []) as Tpl[];
  // The "template as published" previews are signed Canva links that expire; refresh them when needed.
  const templates = canvaRes.data ? await refreshThumbnails(auth.supabase, raw) : raw;
  const layouts = Array.from(new Set(templates.map((t) => t.layout))).map((layout) => {
    const sq = templates.find((t) => t.layout === layout && t.format === 'sq') ?? null;
    const st = templates.find((t) => t.layout === layout && t.format === 'st') ?? null;
    const fields = Array.from(new Set([...Object.entries(sq?.fields ?? {}), ...Object.entries(st?.fields ?? {})].filter(([, v]) => v === 'text').map(([k]) => k)));
    // Prefer the template as published (what the studio fills in); fall back to the last test render.
    return { layout, sq: Boolean(sq), st: Boolean(st), fields, preview: sq?.thumbnail_url ?? sq?.last_render_url ?? st?.thumbnail_url ?? null, previewSq: sq?.thumbnail_url ?? sq?.last_render_url ?? null, previewSt: st?.thumbnail_url ?? st?.last_render_url ?? null };
  }).filter((l) => l.sq);
  return NextResponse.json({
    verticals: VERTICALS.map((v) => ({ value: v.value, label: v.label, category: v.category, photo: v.photo })),
    categories: CATEGORIES.map((c) => ({ key: c.key, order: c.order, label: c.name.en, synced: layouts.some((l) => l.layout === c.key), story: layouts.some((l) => l.layout === c.key && l.st) })),
    tones: TONES,
    photos,
    layouts,
    cadence: { post_time: settings.post_time, days: settings.days, timezone: settings.timezone },
    posts: postRes.data ?? [],
    canva: Boolean(canvaRes.data),
    openai: Boolean(process.env.OPENAI_API_KEY),
    instagram: (await igConfig(auth.supabase)).credentials,
  });
}
