import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function getTenantFromToken(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: tenant } = await admin.from('tenants').select('id').eq('user_id', user.id).single();
  return tenant ? { id: (tenant as { id: string }).id, admin } : null;
}

export async function GET(request: Request) {
  try {
    const ctx = await getTenantFromToken(request);
    if (!ctx) return NextResponse.json({ data: [], error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

    const { id: tenantId, admin } = ctx;
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') ?? 'today';

    // Also fetch staff + services + locations for filter dropdowns
    const [{ data: staffList }, { data: svcList }, { data: locList }] = await Promise.all([
      admin.from('staff').select('id, name').eq('tenant_id', tenantId).eq('status', 'active').order('name'),
      admin.from('services').select('id, name').eq('tenant_id', tenantId).order('name'),
      admin.from('tenant_locations').select('id, name').eq('tenant_id', tenantId).order('name'),
    ]);

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    let query = admin
      .from('appointments')
      .select('id, start_time, end_time, status, booking_type, party_size, total_price, notes, staff_id, location_id, customer_id, service_id, services(name, duration_minutes), staff(id, name), tenant_locations(name)')
      .eq('tenant_id', tenantId)
      .order('start_time', { ascending: true });

    if (tab === 'today') {
      query = query.gte('start_time', todayStart).lt('start_time', todayEnd);
    } else if (tab === 'upcoming') {
      query = query.gte('start_time', todayStart).in('status', ['confirmed', 'approved', 'pending']);
    } else if (tab === 'past') {
      query = query.lt('start_time', todayStart);
    } else if (tab === 'pending') {
      query = query.eq('status', 'pending');
    }

    const { data: rows, error } = await query.limit(50);
    if (error) return NextResponse.json({ data: [], error: error.message }, { status: 500, headers: CORS_HEADERS });

    // Fetch customer data separately (admin client bypasses RLS)
    const customerIds = [...new Set(((rows ?? []) as { customer_id: string | null }[]).map(r => r.customer_id).filter(Boolean))] as string[];
    const customerMap = new Map<string, { display_name: string | null; phone: string | null; no_show_count: number }>();
    if (customerIds.length > 0) {
      const { data: custData } = await admin.from('customers').select('id, display_name, phone, no_show_count').in('id', customerIds);
      for (const c of (custData ?? []) as { id: string; display_name: string | null; phone: string | null; no_show_count: number }[]) {
        customerMap.set(c.id, { display_name: c.display_name, phone: c.phone, no_show_count: c.no_show_count ?? 0 });
      }
    }

    // Enrich with customer data
    const enriched = ((rows ?? []) as Record<string, unknown>[]).map(r => ({
      ...r,
      customers: r.customer_id ? (customerMap.get(r.customer_id as string) ?? null) : null,
    }));

    return NextResponse.json({
      data: enriched,
      filters: {
        staff: staffList ?? [],
        services: svcList ?? [],
        locations: locList ?? [],
      },
    }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[tenant/appointments] error:', err);
    return NextResponse.json({ data: [], error: 'Internal error' }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getTenantFromToken(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

    const { id: tenantId, admin } = ctx;
    const body = await request.json() as { id: string; status?: string; staff_id?: string };

    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

    // Get current appointment for staff change detection
    const { data: currentAppt } = await admin
      .from('appointments')
      .select('staff_id, customer_id, start_time, services(name)')
      .eq('id', body.id)
      .eq('tenant_id', tenantId)
      .single();
    const current = currentAppt as { staff_id: string | null; customer_id: string | null; start_time: string; services: { name: string } | null } | null;

    const updates: Record<string, unknown> = {};
    if (body.status) updates.status = body.status;
    if (body.staff_id) updates.staff_id = body.staff_id;

    const { error } = await admin
      .from('appointments')
      .update(updates as never)
      .eq('id', body.id)
      .eq('tenant_id', tenantId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

    // Notify staff on reassignment
    if (body.staff_id && current && current.staff_id !== body.staff_id) {
      try {
        const { sendNotification } = await import('@/lib/notifications/send');
        const svcName = current.services?.name ?? 'appointment';
        const date = new Date(current.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = new Date(current.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        // Notify new staff
        await sendNotification({
          type: 'new_booking_assigned',
          appointmentId: body.id,
          recipientType: 'staff',
          recipientId: body.staff_id,
          data: { customerName: '', serviceName: svcName, date, time, requiresApproval: 0 },
        });

        // Notify old staff (cancellation)
        if (current.staff_id) {
          await sendNotification({
            type: 'booking_cancelled_staff_notify',
            appointmentId: body.id,
            recipientType: 'staff',
            recipientId: current.staff_id,
            data: { customerName: '', serviceName: svcName, date, time },
          });
        }
      } catch (e) {
        console.error('[tenant/appointments] notification error:', e);
      }
    }

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS });
  }
}
