import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  });
}

/**
 * POST /api/payments/verify-deposit
 * Checks if the deposit payment has succeeded for an appointment and
 * updates the DB accordingly. Called by mobile app after WebView payment
 * to ensure deposit_paid is set even if the webhook hasn't fired yet.
 *
 * Body: { appointmentId: string }
 */
export async function POST(request: Request) {
  try {
    const { appointmentId } = (await request.json()) as { appointmentId: string };
    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, status, deposit_paid, stripe_payment_intent_id')
      .eq('id', appointmentId)
      .single();

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const appt = appointment as { id: string; status: string; deposit_paid: boolean | null; stripe_payment_intent_id: string | null };

    // Already marked as paid
    if (appt.deposit_paid === true) {
      return NextResponse.json({ deposit_paid: true });
    }

    // Check if there's a succeeded payment intent
    if (appt.stripe_payment_intent_id) {
      const pi = await getStripe().paymentIntents.retrieve(appt.stripe_payment_intent_id);
      if (pi.status === 'succeeded') {
        const updateData: Record<string, unknown> = { deposit_paid: true, deposit_amount_paid: pi.amount / 100 };
        if (appt.status === 'approved') updateData.status = 'confirmed';
        await supabase
          .from('appointments')
          .update(updateData as never)
          .eq('id', appointmentId);
        return NextResponse.json({ deposit_paid: true });
      }
    }

    // Check recent checkout sessions for this appointment
    const sessions = await getStripe().checkout.sessions.list({
      limit: 5,
    });

    for (const session of sessions.data) {
      if (session.metadata?.appointment_id === appointmentId && session.payment_status === 'paid') {
        const piId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;

        if (piId) {
          const pi = await getStripe().paymentIntents.retrieve(piId);
          const updateData: Record<string, unknown> = {
            deposit_paid: true,
            deposit_amount_paid: pi.amount / 100,
            stripe_payment_intent_id: piId,
          };
          if (appt.status === 'approved') updateData.status = 'confirmed';
          await supabase
            .from('appointments')
            .update(updateData as never)
            .eq('id', appointmentId);
          return NextResponse.json({ deposit_paid: true });
        }
      }
    }

    return NextResponse.json({ deposit_paid: false });
  } catch (err) {
    console.error('[payments/verify-deposit] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verification failed' },
      { status: 500 },
    );
  }
}
