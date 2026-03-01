import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  if (!tenant?.stripe_customer_id) {
    return NextResponse.json(
      { data: null, error: { message: 'No billing account found' } },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/settings`,
  });

  return NextResponse.json({ data: { url: session.url }, error: null });
}
