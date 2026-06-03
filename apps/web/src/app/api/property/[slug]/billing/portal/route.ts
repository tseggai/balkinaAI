import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { getStripe } from '@/lib/stripe';
import { getOrCreatePropertyCustomer, type PropertyBillingRow } from '@/lib/property-billing';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/** POST /api/property/[slug]/billing/portal — open the Stripe billing portal. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Only property admins can manage billing' }, { status: 403 });

  const admin: Db = ctx.admin;
  const { data: propRow } = await admin
    .from('properties')
    .select('id, name, email, stripe_customer_id, stripe_subscription_id, stripe_seat_item_id, subscription_status, tier, seats')
    .eq('id', ctx.propertyId)
    .single();
  const property = propRow as PropertyBillingRow | null;
  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  const customerId = await getOrCreatePropertyCustomer(admin, property);
  const origin = request.headers.get('origin') ?? process.env.NEXTAUTH_URL ?? 'https://app.balkina.ai';

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/property/${slug}`,
  });

  return NextResponse.json({ url: session.url });
}
