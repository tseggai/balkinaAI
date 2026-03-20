import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import {
  notifyBookingApproved,
  notifyBookingDeclined,
  notifyBookingNoShow,
  notifyBookingCompleted,
  notifyBookingCancelledByTenant,
  notifyDepositPaymentRequired,
} from '@/lib/notifications/booking-events';

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
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const staff = await getStaffRecord(request);
  if (!staff) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { status: string; suggestedTime?: string };
  const newStatus = body.status;
  const suggestedTime = body.suggestedTime;

  if (!newStatus) {
    return NextResponse.json({ data: null, error: { message: 'Missing status' } }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify appointment belongs to this staff
  const { data: appt, error: fetchErr } = await admin
    .from('appointments')
    .select('id, status, customer_id, service_id, tenant_id, deposit_paid, deposit_amount_paid, stripe_payment_intent_id, services(deposit_enabled, deposit_amount, deposit_type, price)')
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

  // Update appointment status
  const { data: updated, error: updateErr } = await admin
    .from('appointments')
    .update({ status: newStatus } as never)
    .eq('id', params.id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ data: null, error: { message: updateErr.message } }, { status: 500 });
  }

  // Fire notifications — AWAIT them so they complete before Vercel terminates the function
  console.log(`[staff/status] appointment ${params.id}: ${appointment.status} → ${newStatus}`);
  try {
    if (newStatus === 'confirmed') {
      // Staff approved a pending booking — handle deposit scenarios
      const hasDeposit = appointment.services?.deposit_enabled && appointment.services?.deposit_amount;
      const depositPaid = appointment.deposit_paid === true;

      if (hasDeposit && !depositPaid && appointment.stripe_payment_intent_id) {
        // Scenario 1: Customer already authorized payment (manual capture) — capture funds now
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
          const pi = await stripe.paymentIntents.retrieve(appointment.stripe_payment_intent_id);
          if (pi.status === 'requires_capture') {
            await stripe.paymentIntents.capture(appointment.stripe_payment_intent_id);
            console.log(`[staff/status] captured held funds for PI ${appointment.stripe_payment_intent_id}`);
            // Webhook will handle marking deposit_paid=true, but also update here for immediate consistency
            await admin
              .from('appointments')
              .update({ deposit_paid: true, deposit_amount_paid: pi.amount / 100 } as never)
              .eq('id', params.id);
          } else {
            console.log(`[staff/status] PI ${appointment.stripe_payment_intent_id} status is ${pi.status}, not capturing`);
          }
        } catch (captureErr) {
          console.error(`[staff/status] failed to capture PI ${appointment.stripe_payment_intent_id}:`, captureErr);
        }
        await notifyBookingApproved(params.id);
      } else if (hasDeposit && !depositPaid) {
        // Scenario 2: No PaymentIntent yet — notify customer to pay deposit
        const svc = appointment.services!;
        const depositAmount = svc.deposit_type === 'percentage'
          ? Math.round((svc.price ?? 0) * (svc.deposit_amount ?? 0) / 100 * 100) / 100
          : (svc.deposit_amount ?? 0);
        await notifyBookingApproved(params.id);
        await notifyDepositPaymentRequired(params.id, depositAmount);
      } else {
        // No deposit required or already paid — standard approval
        await notifyBookingApproved(params.id);
      }
    } else if (newStatus === 'cancelled' && appointment.status === 'pending') {
      // Staff declined a pending booking request
      await notifyBookingDeclined(params.id, suggestedTime);
    } else if (newStatus === 'cancelled' && appointment.status === 'confirmed') {
      // Staff cancelled an already-confirmed booking
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

  return NextResponse.json({ data: updated, error: null });
}
