import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const ctx = await getTenantContext(request);
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
  const ctx = await getTenantContext(request);
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
