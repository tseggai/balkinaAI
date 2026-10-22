import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { canvaConfigured, loadConnection } from '@/lib/canva/client';

// GET /api/admin/canva/status — connection state + registered templates.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const [conn, templates] = await Promise.all([
    loadConnection(auth.supabase),
    auth.supabase.from('ig_templates').select('id, brand_template_id, title, layout, format, fields, thumbnail_url, last_render_url, updated_at').order('title'),
  ]);
  return NextResponse.json({
    configured: canvaConfigured(),
    connected: Boolean(conn),
    connection: conn ? { connected_at: conn.connected_at, expires_at: conn.expires_at, user_id: conn.user_id, team_id: conn.team_id } : null,
    templates: templates.data ?? [],
  });
}
