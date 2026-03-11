import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

const VALID_PLANS = ['starter', 'pro', 'enterprise'] as const;
type PlanKey = (typeof VALID_PLANS)[number];

export async function POST(request: Request) {
  try {
    const { plan } = await request.json() as { plan: string };

    if (!plan || !VALID_PLANS.includes(plan as PlanKey)) {
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

    // Look up the Stripe price ID from the subscription_plans table.
    // Plan name in DB is title-case (Starter, Pro, Enterprise).
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, stripe_price_id')
      .eq('name', planName)
      .single();

    const subPlan = planData as { id: string; stripe_price_id: string | null } | null;

    if (planError || !subPlan?.stripe_price_id) {
      return NextResponse.json(
        { data: null, error: { message: 'Plan not configured', code: 'SETUP_ERROR' } },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      customer: tenant.stripe_customer_id,
      mode: 'subscription',
      line_items: [{ price: subPlan.stripe_price_id, quantity: 1 }],
      success_url: `${request.headers.get('origin') ?? process.env.NEXTAUTH_URL}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin') ?? process.env.NEXTAUTH_URL}/onboarding/select-plan`,
      metadata: { tenant_id: tenant.id, plan_id: subPlan.id },
      subscription_data: {
        metadata: { tenant_id: tenant.id, plan_id: subPlan.id },
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
