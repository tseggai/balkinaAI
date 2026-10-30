import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { CANVA_SCOPES, canvaConfigured, clientId, loadConnection, redirectUri } from '@/lib/canva/client';
import { refreshThumbnails, type TemplateThumbRow } from '@/lib/canva/thumbnails';

// GET /api/admin/canva/status — connection state + registered templates (thumbnail links refreshed when they are about to expire).
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const [conn, templates] = await Promise.all([
    loadConnection(auth.supabase),
    auth.supabase.from('ig_templates').select('id, brand_template_id, title, layout, format, fields, thumbnail_url, last_render_url, updated_at').order('title'),
  ]);
  const rows = (templates.data ?? []) as TemplateThumbRow[];
  return NextResponse.json({
    configured: canvaConfigured(),
    // Diagnostics (client id is public; raw env length reveals stray whitespace/newlines)
    client_id: clientId(),
    client_id_raw_length: (process.env.CANVA_CLIENT_ID ?? '').length,
    redirect_uri: redirectUri(),
    scopes: CANVA_SCOPES,
    connected: Boolean(conn),
    connection: conn ? { connected_at: conn.connected_at, expires_at: conn.expires_at, user_id: conn.user_id, team_id: conn.team_id } : null,
    templates: conn ? await refreshThumbnails(auth.supabase, rows) : rows,
  });
}
