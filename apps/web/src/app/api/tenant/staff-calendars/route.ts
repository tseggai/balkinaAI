import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function getCalendarContext(request: Request) {
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
  const ctx = await getCalendarContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId');
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400, headers: CORS_HEADERS });

  if ('staffOnly' in ctx && ctx.staffOnly !== staffId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: CORS_HEADERS });
  }

  const { data: staff } = await ctx.admin
    .from('staff')
    .select('id, ical_feed_token')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404, headers: CORS_HEADERS });

  const { data: calendars } = await ctx.admin
    .from('staff_external_calendars')
    .select('id, name, ical_url, last_synced_at, last_error, is_active, created_at')
    .eq('staff_id', staffId)
    .eq('tenant_id', ctx.tenantId)
    .order('created_at');

  const s = staff as { id: string; ical_feed_token: string };

  return NextResponse.json({
    data: {
      feedToken: s.ical_feed_token,
      calendars: calendars ?? [],
    },
  }, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const ctx = await getCalendarContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await request.json();
  const { staffId, name, icalUrl } = body as { staffId?: string; name?: string; icalUrl?: string };

  if (!staffId || !icalUrl) {
    return NextResponse.json({ error: 'staffId and icalUrl are required' }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    new URL(icalUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400, headers: CORS_HEADERS });
  }

  const { data: staff } = await ctx.admin
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404, headers: CORS_HEADERS });

  try {
    const res = await fetch(icalUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Calendar URL returned ${res.status}` }, { status: 400, headers: CORS_HEADERS });
    }
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json({ error: 'URL does not return valid iCal data' }, { status: 400, headers: CORS_HEADERS });
    }
  } catch {
    return NextResponse.json({ error: 'Could not fetch calendar URL' }, { status: 400, headers: CORS_HEADERS });
  }

  const { data, error } = await ctx.admin
    .from('staff_external_calendars')
    .insert({
      staff_id: staffId,
      tenant_id: ctx.tenantId,
      name: name || 'External Calendar',
      ical_url: icalUrl,
    } as never)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

  return NextResponse.json({ data }, { status: 201, headers: CORS_HEADERS });
}

export async function DELETE(request: Request) {
  const ctx = await getCalendarContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

  const { error } = await ctx.admin
    .from('staff_external_calendars')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}
