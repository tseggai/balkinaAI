import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return tenant?.id ?? null;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const supabase = createClient();

  // Get all appointments for this tenant to build customer stats
  const { data: appointments } = await supabase
    .from('appointments')
    .select('customer_id, total_price, start_time, status')
    .eq('tenant_id', tenantId);

  if (!appointments) return NextResponse.json({ data: [], error: null });

  // Build customer stats map
  const statsMap = new Map<string, {
    total_bookings: number;
    total_spent: number;
    last_booking_date: string | null;
  }>();

  for (const appt of appointments) {
    const existing = statsMap.get(appt.customer_id) ?? {
      total_bookings: 0,
      total_spent: 0,
      last_booking_date: null,
    };
    existing.total_bookings += 1;
    if (appt.status === 'completed' || appt.status === 'confirmed') {
      existing.total_spent += appt.total_price;
    }
    if (!existing.last_booking_date || appt.start_time > existing.last_booking_date) {
      existing.last_booking_date = appt.start_time;
    }
    statsMap.set(appt.customer_id, existing);
  }

  // Get customer details
  const customerIds = Array.from(statsMap.keys());
  if (customerIds.length === 0) return NextResponse.json({ data: [], error: null });

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .in('id', customerIds);

  // Get behavior profiles
  const { data: profiles } = await supabase
    .from('customer_behavior_profiles')
    .select('*')
    .eq('tenant_id', tenantId);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.customer_id, p])
  );

  const result = (customers ?? []).map((c) => {
    const stats = statsMap.get(c.id);
    const profile = profileMap.get(c.id);
    return {
      ...c,
      total_bookings: stats?.total_bookings ?? 0,
      total_spent: stats?.total_spent ?? 0,
      last_booking_date: stats?.last_booking_date ?? null,
      avg_interval_days: profile?.avg_interval_days ?? null,
      predicted_next_date: profile?.predicted_next_date ?? null,
    };
  });

  result.sort((a, b) => b.total_bookings - a.total_bookings);

  return NextResponse.json({ data: result, error: null });
}
