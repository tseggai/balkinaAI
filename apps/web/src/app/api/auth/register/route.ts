import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      userId: string;
      businessName: string;
      ownerName: string;
      email: string;
      phone?: string;
      categoryId?: string;
    };
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
    let stripeCustomerId: string;
    try {
      const stripe = getStripe();
      const stripeCustomer = await stripe.customers.create({
        name: businessName,
        email,
        phone: phone || undefined,
        metadata: { user_id: userId },
      });
      stripeCustomerId = stripeCustomer.id;
    } catch (stripeErr) {
      const msg = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
      console.error('Stripe customer creation failed:', msg);
      return NextResponse.json(
        { data: null, error: { message: `Payment setup failed: ${msg}`, code: 'STRIPE_ERROR' } },
        { status: 500 }
      );
    }

    // Create tenant record
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        user_id: userId,
        name: businessName,
        owner_name: ownerName,
        email,
        phone: phone || null,
        category_id: categoryId || null,
        stripe_customer_id: stripeCustomerId,
        status: 'pending_subscription' as const,
      } as never)
      .select()
      .single();

    const tenant = tenantData as { id: string } | null;

    if (tenantError || !tenant) {
      // Attempt cleanup of Stripe customer on failure
      try {
        const stripe = getStripe();
        await stripe.customers.del(stripeCustomerId);
      } catch {
        // Cleanup is best-effort
      }
      console.error('Tenant insert failed:', tenantError?.message);
      return NextResponse.json(
        { data: null, error: { message: tenantError?.message ?? 'Failed to create tenant', code: 'DB_ERROR' } },
        { status: 500 }
      );
    }

    // Set tenant_id in user's app_metadata so the JWT carries it.
    // This makes get_my_tenant_id() work for RLS on all tenant-scoped tables.
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { tenant_id: tenant.id },
    });

    return NextResponse.json({ data: { tenantId: tenant.id }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Register route error:', message);
    return NextResponse.json(
      { data: null, error: { message, code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  }
}
