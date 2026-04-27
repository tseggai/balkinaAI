import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

    const { tenantId, tenantName, ownerName, admin } = ctx;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const [allAppts, todayAppts, pendingAppts, staffCount, svcCount] = await Promise.all([
      admin.from('appointments').select('id, total_price, status, customer_id').eq('tenant_id', tenantId),
      admin.from('appointments').select('id').eq('tenant_id', tenantId).gte('start_time', todayStart).lt('start_time', todayEnd).in('status', ['confirmed', 'approved', 'pending']),
      admin.from('appointments').select('id').eq('tenant_id', tenantId).eq('status', 'pending'),
      admin.from('staff').select('id').eq('tenant_id', tenantId),
      admin.from('services').select('id').eq('tenant_id', tenantId),
    ]);

    const allData = (allAppts.data ?? []) as { id: string; total_price: number; status: string; customer_id: string | null }[];
    const completedRevenue = allData.filter(a => a.status === 'completed').reduce((sum, a) => sum + (a.total_price ?? 0), 0);
    const uniqueCustomers = new Set(allData.map(a => a.customer_id).filter(Boolean));

    // Recent appointments (last 10)
    const { data: recentRows } = await admin
      .from('appointments')
      .select('id, start_time, status, customer_id, services(name)')
      .eq('tenant_id', tenantId)
      .order('start_time', { ascending: false })
      .limit(10);

    // Fetch customer names for recent
    const recentCustIds = [...new Set(((recentRows ?? []) as { customer_id: string | null }[]).map(r => r.customer_id).filter(Boolean))] as string[];
    const custMap = new Map<string, string>();
    if (recentCustIds.length > 0) {
      const { data: custs } = await admin.from('customers').select('id, display_name').in('id', recentCustIds);
      for (const c of (custs ?? []) as { id: string; display_name: string | null }[]) {
        custMap.set(c.id, c.display_name ?? 'Guest');
      }
    }

    const recent = ((recentRows ?? []) as Record<string, unknown>[]).map(r => ({
      id: r.id,
      start_time: r.start_time,
      status: r.status,
      customer_name: r.customer_id ? (custMap.get(r.customer_id as string) ?? 'Guest') : 'Guest',
      service_name: ((r.services as { name: string } | null)?.name) ?? 'Service',
    }));

    return NextResponse.json({
      tenantName,
      ownerName: ownerName ?? tenantName,
      stats: {
        totalAppointments: allData.length,
        todayAppointments: (todayAppts.data ?? []).length,
        pendingAppointments: (pendingAppts.data ?? []).length,
        totalRevenue: completedRevenue,
        totalCustomers: uniqueCustomers.size,
        totalStaff: (staffCount.data ?? []).length,
        totalServices: (svcCount.data ?? []).length,
      },
      recent,
    }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[tenant/dashboard] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS });
  }
}
