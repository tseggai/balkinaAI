import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, businessName, ownerName, email, phone, categoryId } = body;

    if (!userId || !businessName || !ownerName || !email) {
      return NextResponse.json(
        { data: null, error: { message: 'Missing required fields', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if tenant already exists for this user
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingTenant) {
      return NextResponse.json(
        { data: null, error: { message: 'Account already exists', code: 'ALREADY_EXISTS' } },
        { status: 409 }
      );
    }

    // Create Stripe customer
    const stripe = getStripe();
    const stripeCustomer = await stripe.customers.create({
      name: businessName,
      email,
      phone: phone || undefined,
      metadata: { user_id: userId },
    });

    // Create tenant record
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        user_id: userId,
        name: businessName,
        owner_name: ownerName,
        email,
        phone: phone || null,
        category_id: categoryId || null,
        stripe_customer_id: stripeCustomer.id,
        status: 'pending_subscription',
      })
      .select()
      .single();

    if (tenantError) {
      // Attempt cleanup of Stripe customer on failure
      await stripe.customers.del(stripeCustomer.id).catch(() => {});
      return NextResponse.json(
        { data: null, error: { message: tenantError.message, code: 'DB_ERROR' } },
        { status: 500 }
      );
    }

    // Send welcome email via API (fire and forget)
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/notifications/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, email, ownerName, businessName }),
    }).catch(() => {});

    return NextResponse.json({ data: { tenantId: tenant.id }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { data: null, error: { message, code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
