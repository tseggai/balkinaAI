import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { PROPERTY_SEAT_PRICE_ID } from '@/lib/stripe';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('[webhooks/stripe] signature verification failed:', message);
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotency check
  const { data: existing } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single();

  if (existing) {
    return NextResponse.json({ received: true, status: 'already_processed' });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const appointmentId = pi.metadata?.appointment_id;
        const paymentType = pi.metadata?.payment_type;
        if (!appointmentId) break;

        console.log(`[webhooks/stripe] payment_intent.succeeded for appointment ${appointmentId}, type=${paymentType}`);

        if (paymentType === 'deposit') {
          // Check if appointment is in 'approved' status — auto-confirm on deposit payment
          const { data: apptRow } = await supabase
            .from('appointments')
            .select('status')
            .eq('id', appointmentId)
            .single();

          const updateData: Record<string, unknown> = {
            deposit_paid: true,
            deposit_amount_paid: pi.amount / 100,
            stripe_payment_intent_id: pi.id,
          };
          if ((apptRow as { status: string } | null)?.status === 'approved') {
            updateData.status = 'confirmed';
          }

          await supabase
            .from('appointments')
            .update(updateData as never)
            .eq('id', appointmentId);
        } else if (paymentType === 'balance') {
          await supabase
            .from('appointments')
            .update({
              balance_due: 0,
            } as never)
            .eq('id', appointmentId);
        }
        break;
      }

      case 'payment_intent.amount_capturable_updated': {
        // Funds authorized (manual capture) — record the PaymentIntent on the appointment
        const pi = event.data.object as Stripe.PaymentIntent;
        const appointmentId = pi.metadata?.appointment_id;
        if (appointmentId && pi.metadata?.capture_method === 'manual') {
          console.log(`[webhooks/stripe] funds authorized (manual capture) for appointment ${appointmentId}, PI ${pi.id}`);
          await supabase
            .from('appointments')
            .update({ stripe_payment_intent_id: pi.id } as never)
            .eq('id', appointmentId);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const appointmentId = pi.metadata?.appointment_id;
        if (appointmentId) {
          console.log(`[webhooks/stripe] payment_intent.payment_failed for appointment ${appointmentId}`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : (charge.payment_intent as Stripe.PaymentIntent | null)?.id;

        if (paymentIntentId) {
          const { data: appointment } = await supabase
            .from('appointments')
            .select('id, total_price, deposit_amount_paid')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .single();

          if (appointment) {
            const refundedAmount = (charge.amount_refunded ?? 0) / 100;
            await supabase
              .from('appointments')
              .update({
                status: 'cancelled' as const,
                balance_due: (appointment.total_price ?? 0) - ((appointment.deposit_amount_paid ?? 0) - refundedAmount),
              } as never)
              .eq('id', appointment.id);
          }
        }
        break;
      }

      case 'customer.subscription.created': {
        // A property subscription was created (self-serve checkout OR a custom
        // deal set up in the Stripe Dashboard with metadata.property_id). Tenant
        // subscriptions carry no property_id and are handled elsewhere.
        const sub = event.data.object as Stripe.Subscription;
        const propertyId = sub.metadata?.property_id;
        if (!propertyId) break;
        const seatItem = sub.items.data.find((i) => i.price.id === PROPERTY_SEAT_PRICE_ID);
        const update: Record<string, unknown> = {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          stripe_seat_item_id: seatItem?.id ?? null,
          seats: seatItem?.quantity ?? 0,
        };
        if (sub.metadata?.plan) update.tier = sub.metadata.plan;
        await supabase.from('properties').update(update as never).eq('id', propertyId);
        console.log(`[webhooks/stripe] property ${propertyId} subscription created (${sub.status})`);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const propertyId = sub.metadata?.property_id;
        if (!propertyId) break;
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
        const update: Record<string, unknown> = { subscription_status: status };
        if (event.type === 'customer.subscription.deleted') update.stripe_subscription_id = null;
        if (event.type === 'customer.subscription.updated' && sub.metadata?.plan) update.tier = sub.metadata.plan;
        await supabase.from('properties').update(update as never).eq('id', propertyId);
        console.log(`[webhooks/stripe] property ${propertyId} subscription ${status}`);
        break;
      }

      default:
        break;
    }

    // Mark event as processed
    await supabase.from('stripe_webhook_events').insert({ stripe_event_id: event.id } as never);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[webhooks/stripe] processing error for ${event.type}:`, err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
