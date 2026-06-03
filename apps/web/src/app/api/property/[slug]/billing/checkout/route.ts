import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { getStripe, PROPERTY_PLAN_PRICE_IDS, PROPERTY_SEAT_PRICE_ID, type PropertyPlanKey } from '@/lib/stripe';
import { getOrCreatePropertyCustomer, countPropertySeats, type PropertyBillingRow } from '@/lib/property-billing';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

const VALID_PLANS: PropertyPlanKey[] = ['essentials', 'premium'];

/**
 * POST /api/property/[slug]/billing/checkout
 * Start a Stripe Checkout subscription for the property: base plan + a per-seat
 * line item priced on the number of linked businesses.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'admin') return NextResponse.json({ error: 'Only property admins can manage billing' }, { status: 403 });

  const { plan } = await request.json() as { plan?: string };
  if (!plan || !VALID_PLANS.includes(plan as PropertyPlanKey)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }
  const planPrice = PROPERTY_PLAN_PRICE_IDS[plan as PropertyPlanKey];
  if (!planPrice) return NextResponse.json({ error: 'This plan is not configured yet' }, { status: 400 });

  const admin: Db = ctx.admin;
  const { data: propRow } = await admin
    .from('properties')
    .select('id, name, email, stripe_customer_id, stripe_subscription_id, stripe_seat_item_id, subscription_status, tier, seats')
    .eq('id', ctx.propertyId)
    .single();
  const property = propRow as PropertyBillingRow | null;
  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  const customerId = await getOrCreatePropertyCustomer(admin, property);
  const seats = await countPropertySeats(admin, ctx.propertyId);

  const lineItems: { price: string; quantity: number }[] = [{ price: planPrice, quantity: 1 }];
  if (PROPERTY_SEAT_PRICE_ID && seats > 0) lineItems.push({ price: PROPERTY_SEAT_PRICE_ID, quantity: seats });

  const origin = request.headers.get('origin') ?? process.env.NEXTAUTH_URL ?? 'https://app.balkina.ai';
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: lineItems,
    success_url: `${origin}/property/${slug}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/property/${slug}?billing=cancel`,
    metadata: { property_id: ctx.propertyId, plan },
    subscription_data: { metadata: { property_id: ctx.propertyId, plan } },
  });

  return NextResponse.json({ url: session.url });
}
