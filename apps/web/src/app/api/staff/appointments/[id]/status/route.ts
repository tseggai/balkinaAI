import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  notifyBookingApproved,
  notifyBookingDeclined,
  notifyBookingNoShow,
  notifyBookingCompleted,
  notifyBookingCancelledByTenant,
  notifyDepositPaymentRequired,
} from '@/lib/notifications/booking-events';
import { pushEventToGoogleCalendar, deleteGoogleCalendarEvent } from '@/lib/google-calendar';

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

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['approved', 'confirmed', 'cancelled'],
  approved: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const staff = await getStaffRecord(request);
  if (!staff) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { status: string; suggestedTime?: string; suggestedTimes?: string[] };
  const newStatus = body.status;
  // Support both single suggestedTime (legacy) and suggestedTimes array (up to 2 alternatives)
  const suggestedTimes = body.suggestedTimes ?? (body.suggestedTime ? [body.suggestedTime] : []);

  if (!newStatus) {
    return NextResponse.json({ data: null, error: { message: 'Missing status' } }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify appointment belongs to this staff
  const { data: appt, error: fetchErr } = await admin
    .from('appointments')
    .select('id, status, customer_id, service_id, tenant_id, start_time, end_time, deposit_paid, deposit_amount_paid, stripe_payment_intent_id, services(deposit_enabled, deposit_amount, deposit_type, price)')
    .eq('id', params.id)
    .eq('staff_id', staff.id)
    .single();

  if (fetchErr || !appt) {
    return NextResponse.json({ data: null, error: { message: 'Appointment not found' } }, { status: 404 });
  }

  const appointment = appt as unknown as {
    id: string;
    status: string;
    customer_id: string;
    service_id: string;
    tenant_id: string;
    start_time: string;
    end_time: string;
    deposit_paid: boolean | null;
    deposit_amount_paid: number | null;
    stripe_payment_intent_id: string | null;
    services: { deposit_enabled: boolean | null; deposit_amount: number | null; deposit_type: string | null; price: number | null } | null;
  };

  // Validate status transition
  const allowed = VALID_TRANSITIONS[appointment.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return NextResponse.json({
      data: null,
      error: { message: `Cannot transition from ${appointment.status} to ${newStatus}` },
    }, { status: 400 });
  }

  // Determine the actual status to write:
  // When staff "confirms" a pending appointment that has an unpaid deposit,
  // set it to "approved" (deposit due) instead of "confirmed".
  const hasDeposit = appointment.services?.deposit_enabled && appointment.services?.deposit_amount;
  const depositPaid = appointment.deposit_paid === true;
  let effectiveStatus = newStatus;

  if (
    newStatus === 'confirmed' &&
    appointment.status === 'pending' &&
    hasDeposit &&
    !depositPaid
  ) {
    effectiveStatus = 'approved';
  }

  // Block confirming/approving if another appointment is already booked for this slot
  if ((effectiveStatus === 'confirmed' || effectiveStatus === 'approved') && appointment.status === 'pending') {
    const { data: conflicts } = await admin
      .from('appointments')
      .select('id')
      .eq('staff_id', staff.id)
      .in('status', ['confirmed', 'approved'])
      .neq('id', params.id)
      .lt('start_time', appointment.end_time)
      .gt('end_time', appointment.start_time)
      .limit(1);
    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({
        data: null,
        error: { message: 'Another appointment is already confirmed for this time slot. Please decline this one or cancel the conflicting appointment first.' },
      }, { status: 409 });
    }
  }

  // Update appointment status (+ save suggested times if declining with suggestions)
  const updateData: Record<string, unknown> = { status: effectiveStatus };
  if (newStatus === 'cancelled' && suggestedTimes.length > 0) {
    const tz = 'UTC';
    updateData.suggested_times = suggestedTimes.map((t) => ({
      date: new Date(t).toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }),
      time: new Date(t).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }),
      iso: t,
    }));
  }

  const { data: updated, error: updateErr } = await admin
    .from('appointments')
    .update(updateData as never)
    .eq('id', params.id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ data: null, error: { message: updateErr.message } }, { status: 500 });
  }

  // Fire notifications — AWAIT them so they complete before Vercel terminates the function
  console.log(`[staff/status] appointment ${params.id}: ${appointment.status} → ${effectiveStatus}`);
  try {
    if (effectiveStatus === 'approved') {
      // Staff approved a pending booking with deposit required
      await notifyBookingApproved(params.id);

      const svc = appointment.services!;
      const depositAmount = svc.deposit_type === 'percentage'
        ? Math.round((svc.price ?? 0) * (svc.deposit_amount ?? 0) / 100 * 100) / 100
        : (svc.deposit_amount ?? 0);
      await notifyDepositPaymentRequired(params.id, depositAmount);
    } else if (effectiveStatus === 'confirmed' && appointment.status === 'pending') {
      // Staff confirmed a pending booking (no deposit required)
      await notifyBookingApproved(params.id);
    } else if (newStatus === 'cancelled' && appointment.status === 'pending') {
      // Staff declined a pending booking request
      await notifyBookingDeclined(params.id, suggestedTimes);
    } else if (newStatus === 'cancelled' && (appointment.status === 'confirmed' || appointment.status === 'approved')) {
      // Staff cancelled an already-confirmed/approved booking
      await notifyBookingCancelledByTenant(params.id);
    } else if (newStatus === 'completed') {
      // Staff marked appointment as completed
      await notifyBookingCompleted(params.id);
    } else if (newStatus === 'no_show') {
      // Staff marked customer as no-show
      await notifyBookingNoShow(params.id);
    }
  } catch (e) {
    console.error('[staff/status] notification error:', e);
  }

  try {
    if (effectiveStatus === 'confirmed' || effectiveStatus === 'approved') {
      await pushEventToGoogleCalendar(params.id);
    } else if (newStatus === 'cancelled' || newStatus === 'no_show') {
      await deleteGoogleCalendarEvent(params.id);
    }
  } catch (e) {
    console.error('[staff/status] google calendar error:', e);
  }

  return NextResponse.json({ data: updated, error: null });
}
