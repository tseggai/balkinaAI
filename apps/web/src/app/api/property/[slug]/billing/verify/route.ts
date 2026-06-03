import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getPropertyAdmin } from '@/lib/property-admin';
import { getStripe, PROPERTY_SEAT_PRICE_ID } from '@/lib/stripe';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/**
 * POST /api/property/[slug]/billing/verify
 * Fast activation after returning from Checkout — reads the session and stores
 * the subscription on the property without waiting for the webhook.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await request.json() as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });

  if (session.metadata?.property_id !== ctx.propertyId) {
    return NextResponse.json({ error: 'Session does not match this property' }, { status: 400 });
  }

  const subscription = session.subscription as Stripe.Subscription | null;
  if (!subscription || (session.payment_status !== 'paid' && subscription.status !== 'active' && subscription.status !== 'trialing')) {
    return NextResponse.json({ status: session.payment_status ?? 'pending' });
  }

  const seatItem = subscription.items.data.find((i) => i.price.id === PROPERTY_SEAT_PRICE_ID);
  const seatQty = seatItem?.quantity ?? 0;

  const admin: Db = ctx.admin;
  await admin.from('properties').update({
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    tier: session.metadata?.plan ?? 'essentials',
    stripe_seat_item_id: seatItem?.id ?? null,
    seats: seatQty,
  }).eq('id', ctx.propertyId);

  return NextResponse.json({ status: 'active', tier: session.metadata?.plan ?? 'essentials', seats: seatQty });
}
