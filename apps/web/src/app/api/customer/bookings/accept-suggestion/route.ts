/**
 * POST /api/customer/bookings/accept-suggestion
 * Accept a staff's suggested reschedule time by creating a new booking
 * based on the original cancelled appointment's details.
 * Body: { appointmentId (the cancelled one), userId, suggestedTimeIso }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyBookingSubmitted, notifyBookingConfirmed, notifyStaffNewBooking } from '@/lib/notifications/booking-events';

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
        services(duration_minutes),
        staff(requires_approval)
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
      total_price: number;
      services: { duration_minutes: number } | null;
      staff: { requires_approval: boolean } | null;
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

    const requiresApproval = orig.staff?.requires_approval ?? false;

    // Create new appointment
    const { data: newAppt, error: insertErr } = await supabase
      .from('appointments')
      .insert({
        customer_id: customerId,
        tenant_id: orig.tenant_id,
        service_id: orig.service_id,
        staff_id: orig.staff_id,
        location_id: orig.location_id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: requiresApproval ? 'pending' : 'confirmed',
        total_price: orig.total_price,
        deposit_paid: false,
        notes: `Rescheduled from appointment ${orig.id.slice(0, 8)}`,
      } as never)
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500, headers: CORS_HEADERS });
    }

    const newApptId = (newAppt as { id: string }).id;

    // Fire notifications
    try {
      if (requiresApproval) {
        await Promise.allSettled([
          notifyBookingSubmitted(newApptId),
          notifyStaffNewBooking(newApptId),
        ]);
      } else {
        await Promise.allSettled([
          notifyBookingConfirmed(newApptId),
          notifyStaffNewBooking(newApptId),
        ]);
      }
    } catch (e) {
      console.error('[accept-suggestion] notification error:', e);
    }

    return NextResponse.json(
      { success: true, appointmentId: newApptId, status: requiresApproval ? 'pending' : 'confirmed' },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error('[customer/bookings/accept-suggestion] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
