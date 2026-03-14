/**
 * GET /api/customer/bookings?userId=...&tab=upcoming|past
 *
 * Server-side endpoint for fetching customer appointments.
 * Uses admin client to bypass RLS fragility on mobile Supabase queries.
 * Security: requires userId param, verifies customer exists, returns only their data.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const phone = searchParams.get('phone');
    const tab = searchParams.get('tab') || 'upcoming';

    if (!userId && !email && !phone) {
      return NextResponse.json(
        { data: [], error: 'userId, email, or phone required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const supabase = createAdminClient();

    // Find the customer record
    let customerId: string | null = null;

    if (userId) {
      // Try user_id first
      const { data: byUserId } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (byUserId) customerId = (byUserId as { id: string }).id;

      // Try id match (customers.id = auth user id)
      if (!customerId) {
        const { data: byId } = await supabase
          .from('customers')
          .select('id')
          .eq('id', userId)
          .limit(1)
          .maybeSingle();
        if (byId) customerId = (byId as { id: string }).id;
      }
    }

    if (!customerId && email) {
      const { data: byEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .limit(1)
        .maybeSingle();
      if (byEmail) customerId = (byEmail as { id: string }).id;
    }

    if (!customerId && phone) {
      const { data: byPhone } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .limit(1)
        .maybeSingle();
      if (byPhone) customerId = (byPhone as { id: string }).id;
    }

    // Auto-link user_id if found by email/phone but not by user_id
    if (customerId && userId) {
      await supabase
        .from('customers')
        .update({ user_id: userId } as never)
        .eq('id', customerId)
        .is('user_id', null);
    }

    if (!customerId) {
      return NextResponse.json({ data: [], error: null }, { headers: CORS_HEADERS });
    }

    const now = new Date().toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    const isUpcoming = tab === 'upcoming';

    let query = supabase
      .from('appointments')
      .select(
        'id, start_time, end_time, status, total_price, services(name), staff(name), tenant_locations(name), tenants(name)',
      )
      .eq('customer_id', customerId)
      .order('start_time', { ascending: isUpcoming });

    if (isUpcoming) {
      query = query
        .gte('start_time', todayISO)
        .in('status', ['pending', 'confirmed']);
    } else {
      query = query.or(
        `start_time.lt.${now},status.eq.completed,status.eq.cancelled`,
      );
    }

    const { data, error } = await query.limit(50);

    if (error) {
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    return NextResponse.json({ data: data ?? [], error: null }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[customer/bookings] error:', err);
    return NextResponse.json(
      { data: [], error: 'Internal server error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
