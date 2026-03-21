import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const PLATFORM_COMMISSION_RATE = 0.1;

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  });
}

/**
 * POST /api/payments/checkout-session
 * Creates a Stripe Checkout Session for an appointment deposit.
 * Used by the /pay/[id] page inside the mobile WebView where
 * Stripe Elements iframes cannot render.
 *
 * Body: { appointmentId: string; successUrl: string; cancelUrl: string }
 * Returns: { url: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      appointmentId: string;
      successUrl: string;
      cancelUrl: string;
    };
    const { appointmentId, successUrl, cancelUrl } = body;

    if (!appointmentId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'appointmentId, successUrl, and cancelUrl are required' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .select(
        `
        id, customer_id, tenant_id, service_id, total_price,
        deposit_paid, deposit_amount_paid, stripe_payment_intent_id,
        services(name, deposit_enabled, deposit_type, deposit_amount, price),
        tenants(name, stripe_account_id, payments_enabled)
      `,
      )
      .eq('id', appointmentId)
      .single();

    if (apptErr || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const raw = appointment as unknown as {
      id: string;
      customer_id: string;
      tenant_id: string;
      total_price: number;
      deposit_paid: boolean;
      deposit_amount_paid: number | null;
      stripe_payment_intent_id: string | null;
      services:
        | {
            name: string;
            deposit_enabled: boolean;
            deposit_type: string | null;
            deposit_amount: number | null;
            price: number;
          }[]
        | {
            name: string;
            deposit_enabled: boolean;
            deposit_type: string | null;
            deposit_amount: number | null;
            price: number;
          }
        | null;
      tenants:
        | { name: string; stripe_account_id: string | null; payments_enabled: boolean }[]
        | { name: string; stripe_account_id: string | null; payments_enabled: boolean }
        | null;
    };
    const appt = {
      ...raw,
      services: Array.isArray(raw.services) ? (raw.services[0] ?? null) : raw.services,
      tenants: Array.isArray(raw.tenants) ? (raw.tenants[0] ?? null) : raw.tenants,
    };

    if (appt.deposit_paid) {
      return NextResponse.json({ error: 'Deposit already paid' }, { status: 400 });
    }

    if (!appt.tenants?.payments_enabled) {
      return NextResponse.json(
        { error: 'Payments not enabled for this business' },
        { status: 400 },
      );
    }

    if (!appt.tenants?.stripe_account_id) {
      return NextResponse.json(
        { error: 'Business has not connected a Stripe account' },
        { status: 400 },
      );
    }

    const depositAmount = appt.deposit_amount_paid ?? 0;
    if (depositAmount <= 0) {
      return NextResponse.json(
        { error: 'No deposit amount set for this appointment' },
        { status: 400 },
      );
    }

    // If payment already succeeded, short-circuit
    if (appt.stripe_payment_intent_id) {
      const existingPi = await getStripe().paymentIntents.retrieve(
        appt.stripe_payment_intent_id,
      );
      if (existingPi.status === 'succeeded') {
        return NextResponse.json({ error: 'Deposit already paid' }, { status: 400 });
      }
    }

    const depositAmountCents = Math.round(depositAmount * 100);
    const platformFeeCents = Math.round(depositAmountCents * PLATFORM_COMMISSION_RATE);

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Deposit — ${appt.services?.name ?? 'Appointment'}`,
              description: `at ${appt.tenants.name}`,
            },
            unit_amount: depositAmountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        transfer_data: {
          destination: appt.tenants.stripe_account_id,
        },
        application_fee_amount: platformFeeCents,
        metadata: {
          appointment_id: appointmentId,
          customer_id: appt.customer_id,
          payment_type: 'deposit',
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        appointment_id: appointmentId,
        customer_id: appt.customer_id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[payments/checkout-session] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Checkout session creation failed' },
      { status: 500 },
    );
  }
}
