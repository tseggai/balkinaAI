import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function getStaffRecord(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;

  const { data: staff } = await admin
    .from('staff')
    .select('id, tenant_id, name')
    .eq('user_id', user.id)
    .single();

  return staff as { id: string; tenant_id: string; name: string } | null;
}

export async function GET(request: Request) {
  const staff = await getStaffRecord(request);
  if (!staff) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const status = searchParams.get('status');
  const period = searchParams.get('period') ?? 'today'; // today | upcoming | past
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const admin = createAdminClient();

  let query = admin
    .from('appointments')
    .select('*, services(name, duration_minutes), customers(display_name, phone, email), tenant_locations(name)')
    .eq('staff_id', staff.id)
    .eq('tenant_id', staff.tenant_id);

  const now = new Date().toISOString();

  if (date) {
    // Specific date filter
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;
    query = query.gte('start_time', dayStart).lte('start_time', dayEnd);
  } else if (period === 'today') {
    const today = new Date().toISOString().split('T')[0];
    query = query.gte('start_time', `${today}T00:00:00.000Z`).lte('start_time', `${today}T23:59:59.999Z`);
  } else if (period === 'upcoming') {
    query = query.gte('start_time', now).in('status', ['pending', 'confirmed']);
  } else if (period === 'past') {
    query = query.lt('start_time', now);
  }

  if (status) {
    query = query.eq('status', status);
  }

  query = query.order('start_time', { ascending: period !== 'past' }).range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Map to StaffAppointment shape
  const appointments = ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const svc = row.services as { name: string; duration_minutes: number } | null;
    const cust = row.customers as { display_name: string | null; phone: string | null } | null;
    const loc = row.tenant_locations as { name: string } | null;
    return {
      id: row.id,
      customer_name: cust?.display_name ?? 'Guest',
      customer_phone: cust?.phone ?? null,
      service_name: svc?.name ?? 'Service',
      service_duration: svc?.duration_minutes ?? 0,
      date: typeof row.start_time === 'string' ? row.start_time.split('T')[0] : '',
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      total_price: row.total_price,
      notes: row.notes ?? null,
      location_name: loc?.name ?? null,
    };
  });

  return NextResponse.json({ data: appointments, error: null });
}
