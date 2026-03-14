/**
 * POST /api/customer/bookings/cancel
 * Cancel a customer appointment.
 * Body: { appointmentId, userId }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { appointmentId: string; userId?: string };
    const { appointmentId, userId } = body;

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400, headers: CORS_HEADERS });
    }

    const supabase = createAdminClient();

    // Find customer ID from userId
    let customerId: string | null = null;
    if (userId) {
      const { data: byUserId } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (byUserId) customerId = (byUserId as { id: string }).id;

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

    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: CORS_HEADERS });
    }

    // Verify appointment belongs to customer and is cancellable
    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .select('id, status, customer_id')
      .eq('id', appointmentId)
      .eq('customer_id', customerId)
      .single();

    if (apptErr || !appt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const status = (appt as { status: string }).status;
    if (status === 'cancelled' || status === 'completed') {
      return NextResponse.json({ error: `Cannot cancel a ${status} appointment` }, { status: 400, headers: CORS_HEADERS });
    }

    const { error: updateErr } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' } as never)
      .eq('id', appointmentId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[customer/bookings/cancel] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
