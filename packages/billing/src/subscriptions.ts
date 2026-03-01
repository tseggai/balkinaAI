/**
 * Tenant subscription management via Stripe Billing.
 * Handles plan creation, upgrades, downgrades, and cancellations.
 */
import Stripe from 'stripe';
import { serverEnv } from '@balkina/config';
import { PLATFORM_COMMISSION_RATE } from '@balkina/shared';

export const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
  typescript: true,
});

export interface CreateSubscriptionParams {
  tenantId: string;
  stripeCustomerId: string;
  stripePriceId: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  status: Stripe.Subscription.Status;
  currentPeriodEnd: Date;
  clientSecret?: string;
}

/**
 * Create a new Stripe subscription for a tenant.
 * Returns the subscription and a client secret if payment confirmation is needed.
 */
export async function createTenantSubscription({
  tenantId,
  stripeCustomerId,
  stripePriceId,
}: CreateSubscriptionParams): Promise<SubscriptionResult> {
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: stripePriceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: { tenant_id: tenantId },
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent | null;

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    clientSecret: paymentIntent?.client_secret ?? undefined,
  };
}

/**
 * Update a tenant's subscription to a different plan.
 */
export async function updateTenantSubscription(
  subscriptionId: string,
  newStripePriceId: string
): Promise<SubscriptionResult> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const firstItem = subscription.items.data[0];
  if (!firstItem) throw new Error('Subscription has no items');

  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: firstItem.id, price: newStripePriceId }],
    proration_behavior: 'create_prorations',
  });

  return {
    subscriptionId: updated.id,
    status: updated.status,
    currentPeriodEnd: new Date(updated.current_period_end * 1000),
  };
}

/**
 * Cancel a tenant's subscription at period end.
 */
export async function cancelTenantSubscription(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

/**
 * Create or retrieve a Stripe customer for a tenant.
 */
export async function getOrCreateStripeCustomer(
  tenantId: string,
  tenantName: string,
  email: string
): Promise<string> {
  const existing = await stripe.customers.search({
    query: `metadata['tenant_id']:'${tenantId}'`,
    limit: 1,
  });

  if (existing.data.length > 0 && existing.data[0]) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    name: tenantName,
    email,
    metadata: { tenant_id: tenantId },
  });

  return customer.id;
}

// Re-export for convenience
export { PLATFORM_COMMISSION_RATE };
