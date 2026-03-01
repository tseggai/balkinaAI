import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { createServerAdminClient } from '@balkina/db';

/**
 * POST /api/checkout/verify
 * Verifies a completed Stripe Checkout session and activates the tenant
 * immediately, without waiting for the asynchronous webhook.
 */
export async function POST(request: Request) {
  try {
    const { sessionId } = (await request.json()) as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json(
        { data: null, error: { message: 'Missing session_id', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    // Verify the caller is authenticated
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    // Retrieve the Checkout Session from Stripe
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { data: { status: 'pending' }, error: null },
        { status: 200 }
      );
    }

    // Ensure the session belongs to this user's tenant
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id, stripe_customer_id, status')
      .eq('user_id', user.id)
      .single();

    const tenant = tenantData as { id: string; stripe_customer_id: string | null; status: string } | null;

    if (!tenant || tenant.stripe_customer_id !== session.customer) {
      return NextResponse.json(
        { data: null, error: { message: 'Session does not belong to this tenant', code: 'FORBIDDEN' } },
        { status: 403 }
      );
    }

    // If already active, skip update
    if (tenant.status === 'active') {
      return NextResponse.json({ data: { status: 'active' }, error: null });
    }

    // Extract subscription info
    const subscription =
      typeof session.subscription === 'object' ? session.subscription : null;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : subscription?.id ?? null;
    const priceId = subscription?.items?.data[0]?.price.id ?? null;

    // Look up plan
    const adminClient = createServerAdminClient();
    let planId: string | null = null;
    if (priceId) {
      const { data: plan } = await adminClient
        .from('subscription_plans')
        .select('id')
        .eq('stripe_price_id', priceId)
        .single();
      planId = (plan as { id: string } | null)?.id ?? null;
    }

    // Fallback: use plan_id from session metadata
    if (!planId && session.metadata?.plan_id) {
      planId = session.metadata.plan_id;
    }

    // Activate tenant
    await adminClient
      .from('tenants')
      .update({
        status: 'active' as const,
        stripe_subscription_id: subscriptionId,
        subscription_plan_id: planId,
      } as never)
      .eq('id', tenant.id);

    return NextResponse.json({ data: { status: 'active' }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: { message, code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
