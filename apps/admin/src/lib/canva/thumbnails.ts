import type { SupabaseClient } from '@supabase/supabase-js';
import { accessToken, listBrandTemplates } from '@/lib/canva/client';

export interface TemplateThumbRow { id: string; brand_template_id: string; thumbnail_url: string | null }

/** Canva thumbnails are signed S3 URLs (X-Amz-Date + X-Amz-Expires); treat them as stale an hour before they expire. */
export function thumbnailStale(url: string | null, now = Date.now()): boolean {
  if (!url) return true;
  try {
    const q = new URL(url).searchParams;
    const date = q.get('X-Amz-Date'), expires = Number(q.get('X-Amz-Expires'));
    if (!date || !expires) return false;
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(date);
    if (!m) return false;
    const signed = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
    return now > signed + (expires - 3600) * 1000;
  } catch {
    return false;
  }
}

/** Re-reads the brand templates from Canva and stores fresh thumbnail URLs for the rows whose links are about to expire.
    Never throws: a status page must not fail because a thumbnail could not be refreshed. */
export async function refreshThumbnails<T extends TemplateThumbRow>(supabase: SupabaseClient, rows: T[]): Promise<T[]> {
  if (!rows.some((r) => thumbnailStale(r.thumbnail_url))) return rows;
  try {
    const token = await accessToken(supabase);
    const fresh = new Map((await listBrandTemplates(token)).map((t) => [t.id, t.thumbnail?.url ?? null]));
    const changed = rows.filter((r) => fresh.has(r.brand_template_id) && fresh.get(r.brand_template_id) !== r.thumbnail_url);
    await Promise.all(changed.map((r) => supabase.from('ig_templates').update({ thumbnail_url: fresh.get(r.brand_template_id) ?? null }).eq('id', r.id)));
    return rows.map((r) => (fresh.has(r.brand_template_id) ? { ...r, thumbnail_url: fresh.get(r.brand_template_id) ?? null } : r));
  } catch {
    return rows;
  }
}
