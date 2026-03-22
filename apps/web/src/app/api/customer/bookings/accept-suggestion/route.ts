/**
 * POST /api/customer/bookings/accept-suggestion
 * Accept a staff's suggested reschedule time by reactivating the original
 * cancelled appointment with the new time. The staff already pre-approved
 * the suggested time, so no new approval cycle is needed.
 *
 * - If deposit is required: status → 'approved' (customer must pay deposit)
 * - If no deposit: status → 'confirmed'
 *
 * Body: { appointmentId (the cancelled one), userId, suggestedTimeIso }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyBookingConfirmed, notifyDepositPaymentRequired } from '@/lib/notifications/booking-events';

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
    const body = (await request.json()) as {
      appointmentId: string;
      userId: string;
      suggestedTimeIso: string;
    };
    const { appointmentId, userId, suggestedTimeIso } = body;

    if (!appointmentId || !userId || !suggestedTimeIso) {
      return NextResponse.json(
        { error: 'appointmentId, userId, and suggestedTimeIso are required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const supabase = createAdminClient();

    // Find customer ID
    let customerId: string | null = null;
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

    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: CORS_HEADERS });
    }

    // Get original appointment details
    const { data: origAppt, error: origErr } = await supabase
      .from('appointments')
      .select(`
        id, status, customer_id, tenant_id, service_id, staff_id, location_id, total_price,
        deposit_paid,
        services(duration_minutes, deposit_enabled, deposit_amount, deposit_type, price),
        tenants(payments_enabled)
      `)
      .eq('id', appointmentId)
      .eq('customer_id', customerId)
      .single();

    if (origErr || !origAppt) {
      return NextResponse.json({ error: 'Original appointment not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const orig = origAppt as unknown as {
      id: string; status: string; customer_id: string; tenant_id: string;
      service_id: string; staff_id: string | null; location_id: string | null;
      total_price: number; deposit_paid: boolean | null;
      services: { duration_minutes: number; deposit_enabled: boolean | null; deposit_amount: number | null; deposit_type: string | null; price: number | null } | null;
      tenants: { payments_enabled: boolean | null } | null;
    };

    if (orig.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Can only accept suggestions for cancelled appointments' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Calculate new start/end times
    const start = new Date(suggestedTimeIso);
    const durationMin = orig.services?.duration_minutes ?? 60;
    const end = new Date(start.getTime() + durationMin * 60000);

    // Reject if less than 15 minutes from now
    if (start.getTime() < Date.now() + 15 * 60000) {
      return NextResponse.json(
        { error: 'The suggested time has passed. Please book a new appointment.' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Determine status: staff already approved the time they suggested,
    // so no new approval loop. If deposit is required → 'approved' (deposit due).
    // If no deposit → 'confirmed' directly.
    const paymentsEnabled = orig.tenants?.payments_enabled ?? false;
    const hasDeposit = paymentsEnabled && orig.services?.deposit_enabled && orig.services?.deposit_amount;
    const depositAlreadyPaid = orig.deposit_paid === true;
    const newStatus = (hasDeposit && !depositAlreadyPaid) ? 'approved' : 'confirmed';

    // Reactivate the original appointment with new time — no new row needed
    const { error: updateErr } = await supabase
      .from('appointments')
      .update({
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: newStatus,
        notes: `Rescheduled (accepted staff suggestion)`,
      } as never)
      .eq('id', appointmentId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500, headers: CORS_HEADERS });
    }

    // Fire notifications
    try {
      if (newStatus === 'approved' && hasDeposit) {
        const svc = orig.services!;
        const depositAmount = svc.deposit_type === 'percentage'
          ? Math.round((svc.price ?? 0) * (svc.deposit_amount ?? 0) / 100 * 100) / 100
          : (svc.deposit_amount ?? 0);
        await notifyDepositPaymentRequired(appointmentId, depositAmount);
      } else {
        await notifyBookingConfirmed(appointmentId);
      }
    } catch (e) {
      console.error('[accept-suggestion] notification error:', e);
    }

    return NextResponse.json(
      { success: true, appointmentId, status: newStatus },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error('[customer/bookings/accept-suggestion] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
