import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, PLAN_PRICE_IDS, type PlanKey } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const { plan } = await request.json() as { plan: string };

    if (!plan || !PLAN_PRICE_IDS[plan as PlanKey]) {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid plan selected', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    // Get tenant for this user
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    const tenant = tenantData as { id: string; stripe_customer_id: string | null } | null;

    if (tenantError || !tenant) {
      return NextResponse.json(
        { data: null, error: { message: 'Tenant not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    if (!tenant.stripe_customer_id) {
      return NextResponse.json(
        { data: null, error: { message: 'Stripe customer not configured', code: 'SETUP_ERROR' } },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const priceId = PLAN_PRICE_IDS[plan as PlanKey];

    const session = await stripe.checkout.sessions.create({
      customer: tenant.stripe_customer_id,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${request.headers.get('origin') ?? process.env.NEXTAUTH_URL}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin') ?? process.env.NEXTAUTH_URL}/onboarding/select-plan`,
      metadata: { tenant_id: tenant.id },
      subscription_data: {
        metadata: { tenant_id: tenant.id },
      },
    });

    return NextResponse.json({ data: { url: session.url }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: { message, code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
