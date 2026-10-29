import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { CANVA_SCOPES, accessToken, canvaConfigured, clientId, listBrandTemplates, loadConnection, redirectUri } from '@/lib/canva/client';

interface TemplateRow { id: string; brand_template_id: string; thumbnail_url: string | null; [k: string]: unknown }

/** Canva thumbnails are signed S3 URLs (X-Amz-Date + X-Amz-Expires); treat them as stale an hour before they expire. */
function thumbnailStale(url: string | null, now = Date.now()): boolean {
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

/** Re-reads the brand templates from Canva and stores fresh thumbnail URLs for the rows whose links are about to expire. */
async function refreshThumbnails(supabase: Parameters<typeof accessToken>[0], rows: TemplateRow[]): Promise<TemplateRow[]> {
  if (!rows.some((r) => thumbnailStale(r.thumbnail_url))) return rows;
  try {
    const token = await accessToken(supabase);
    const fresh = new Map((await listBrandTemplates(token)).map((t) => [t.id, t.thumbnail?.url ?? null]));
    const changed = rows.filter((r) => fresh.has(r.brand_template_id) && fresh.get(r.brand_template_id) !== r.thumbnail_url);
    await Promise.all(changed.map((r) => supabase.from('ig_templates').update({ thumbnail_url: fresh.get(r.brand_template_id) ?? null }).eq('id', r.id)));
    return rows.map((r) => (fresh.has(r.brand_template_id) ? { ...r, thumbnail_url: fresh.get(r.brand_template_id) ?? null } : r));
  } catch {
    return rows; // the status must not fail because a thumbnail could not be refreshed
  }
}

// GET /api/admin/canva/status — connection state + registered templates (thumbnail links refreshed when they are about to expire).
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const [conn, templates] = await Promise.all([
    loadConnection(auth.supabase),
    auth.supabase.from('ig_templates').select('id, brand_template_id, title, layout, format, fields, thumbnail_url, last_render_url, updated_at').order('title'),
  ]);
  const rows = conn ? await refreshThumbnails(auth.supabase, (templates.data ?? []) as TemplateRow[]) : (templates.data ?? []);
  return NextResponse.json({
    configured: canvaConfigured(),
    // Diagnostics (client id is public; raw env length reveals stray whitespace/newlines)
    client_id: clientId(),
    client_id_raw_length: (process.env.CANVA_CLIENT_ID ?? '').length,
    redirect_uri: redirectUri(),
    scopes: CANVA_SCOPES,
    connected: Boolean(conn),
    connection: conn ? { connected_at: conn.connected_at, expires_at: conn.expires_at, user_id: conn.user_id, team_id: conn.team_id } : null,
    templates: rows,
  });
}
