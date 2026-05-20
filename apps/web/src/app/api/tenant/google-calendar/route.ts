import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function getGcalContext(request: Request) {
  const ctx = await getTenantContext(request);
  if (ctx) return { tenantId: ctx.tenantId, admin: ctx.admin };

  const token = getBearerToken(request);
  if (!token) return null;
  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: staff } = await admin.from('staff').select('id, tenant_id').eq('user_id', user.id).single();
  if (!staff) return null;
  const s = staff as { id: string; tenant_id: string };
  return { tenantId: s.tenant_id, admin, staffOnly: s.id };
}

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const ctx = await getGcalContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId');
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400, headers: CORS_HEADERS });

  const { data } = await ctx.admin
    .from('staff_google_calendar_connections')
    .select('id, google_email, calendar_id, is_active, created_at')
    .eq('staff_id', staffId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null }, { headers: CORS_HEADERS });
}

export async function DELETE(request: Request) {
  const ctx = await getGcalContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId');
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400, headers: CORS_HEADERS });

  const { data: conn } = await ctx.admin
    .from('staff_google_calendar_connections')
    .select('id, access_token')
    .eq('staff_id', staffId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();

  if (conn) {
    const c = conn as { id: string; access_token: string };
    await fetch(`https://oauth2.googleapis.com/revoke?token=${c.access_token}`, { method: 'POST' }).catch(() => {});

    await ctx.admin.from('external_calendar_events')
      .delete()
      .eq('staff_id', staffId)
      .eq('external_calendar_id', c.id);

    await ctx.admin.from('staff_google_calendar_connections').delete().eq('id', c.id);
  }

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}
