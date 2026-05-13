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
 * POST /api/payments/create-deposit
 * Creates a Stripe PaymentIntent for an appointment deposit.
 * Body: { appointmentId: string }
 * Returns: { clientSecret, paymentIntentId, amount, currency }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { appointmentId: string };
    const { appointmentId } = body;

    if (!appointmentId) {
      return NextResponse.json({ error: 'appointmentId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch appointment with related data
    const { data: appointment, error: apptErr } = await supabase
      .from('appointments')
      .select(`
        id, customer_id, tenant_id, service_id, total_price, location_id,
        deposit_paid, deposit_amount_paid, stripe_payment_intent_id,
        services(name, deposit_enabled, deposit_type, deposit_amount, price),
        tenants(name, stripe_account_id, payments_enabled),
        tenant_locations(currency)
      `)
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
      services: { name: string; deposit_enabled: boolean; deposit_type: string | null; deposit_amount: number | null; price: number }[] | { name: string; deposit_enabled: boolean; deposit_type: string | null; deposit_amount: number | null; price: number } | null;
      tenants: { name: string; stripe_account_id: string | null; payments_enabled: boolean }[] | { name: string; stripe_account_id: string | null; payments_enabled: boolean } | null;
      tenant_locations: { currency: string } | { currency: string }[] | null;
    };
    const appt = {
      ...raw,
      services: Array.isArray(raw.services) ? raw.services[0] ?? null : raw.services,
      tenants: Array.isArray(raw.tenants) ? raw.tenants[0] ?? null : raw.tenants,
      tenant_locations: Array.isArray(raw.tenant_locations) ? raw.tenant_locations[0] ?? null : raw.tenant_locations,
    };
    const locationCurrency = (appt.tenant_locations?.currency ?? 'USD').toLowerCase();

    if (appt.deposit_paid) {
      return NextResponse.json({ error: 'Deposit already paid' }, { status: 400 });
    }

    if (!appt.tenants?.payments_enabled) {
      return NextResponse.json({ error: 'Payments not enabled for this business' }, { status: 400 });
    }

    if (!appt.tenants?.stripe_account_id) {
      return NextResponse.json({ error: 'Business has not connected a Stripe account' }, { status: 400 });
    }

    const depositAmount = appt.deposit_amount_paid ?? 0;
    if (depositAmount <= 0) {
      return NextResponse.json({ error: 'No deposit amount set for this appointment' }, { status: 400 });
    }

    // If a PaymentIntent already exists, retrieve it
    if (appt.stripe_payment_intent_id) {
      const existingPi = await getStripe().paymentIntents.retrieve(appt.stripe_payment_intent_id);
      if (existingPi.status === 'succeeded') {
        return NextResponse.json({ error: 'Deposit already paid' }, { status: 400 });
      }
      return NextResponse.json({
        clientSecret: existingPi.client_secret,
        paymentIntentId: existingPi.id,
        amount: existingPi.amount,
        currency: existingPi.currency,
      });
    }

    // Create new PaymentIntent
    const depositAmountCents = Math.round(depositAmount * 100);
    const platformFeeCents = Math.round(depositAmountCents * PLATFORM_COMMISSION_RATE);

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: depositAmountCents,
      currency: locationCurrency,
      automatic_payment_methods: { enabled: true },
      transfer_data: {
        destination: appt.tenants.stripe_account_id,
      },
      application_fee_amount: platformFeeCents,
      metadata: {
        appointment_id: appointmentId,
        customer_id: appt.customer_id,
        payment_type: 'deposit',
      },
      description: `Deposit for ${appt.services?.name ?? 'appointment'} at ${appt.tenants.name}`,
    });

    // Store PaymentIntent ID on the appointment
    await supabase
      .from('appointments')
      .update({ stripe_payment_intent_id: paymentIntent.id } as never)
      .eq('id', appointmentId);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (err) {
    console.error('[payments/create-deposit] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment creation failed' },
      { status: 500 },
    );
  }
}
