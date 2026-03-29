/**
 * Tenant subscription management via Stripe Billing.
 * Handles plan creation, upgrades, downgrades, add-ons, and cancellations.
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
  extraStaffPriceId?: string;
  extraStaffQuantity?: number;
  onlinePaymentsPriceId?: string;
}

export interface SubscriptionResult {
  subscriptionId: string;
  status: Stripe.Subscription.Status;
  currentPeriodEnd: Date;
  clientSecret?: string;
  extraStaffItemId?: string;
  onlinePaymentsItemId?: string;
}

/**
 * Create a new Stripe subscription for a tenant.
 * Supports multiple line items: base plan + optional extra staff + optional online payments.
 */
export async function createTenantSubscription({
  tenantId,
  stripeCustomerId,
  stripePriceId,
  extraStaffPriceId,
  extraStaffQuantity,
  onlinePaymentsPriceId,
}: CreateSubscriptionParams): Promise<SubscriptionResult> {
  const items: Stripe.SubscriptionCreateParams.Item[] = [
    { price: stripePriceId },
  ];

  if (extraStaffPriceId && extraStaffQuantity && extraStaffQuantity > 0) {
    items.push({ price: extraStaffPriceId, quantity: extraStaffQuantity });
  }

  if (onlinePaymentsPriceId) {
    items.push({ price: onlinePaymentsPriceId });
  }

  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items,
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: { tenant_id: tenantId },
  });

  const invoice = subscription.latest_invoice as Stripe.Invoice;
  const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent | null;

  // Find the item IDs for add-ons so we can update quantities later
  let extraStaffItemId: string | undefined;
  let onlinePaymentsItemId: string | undefined;

  for (const item of subscription.items.data) {
    if (item.price.id === extraStaffPriceId) {
      extraStaffItemId = item.id;
    } else if (item.price.id === onlinePaymentsPriceId) {
      onlinePaymentsItemId = item.id;
    }
  }

  return {
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    clientSecret: paymentIntent?.client_secret ?? undefined,
    extraStaffItemId,
    onlinePaymentsItemId,
  };
}

/**
 * Update a tenant's subscription to a different base plan.
 * Preserves existing add-on items (extra staff, online payments).
 */
export async function updateTenantSubscription(
  subscriptionId: string,
  newStripePriceId: string
): Promise<SubscriptionResult> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Find the base plan item (the one that isn't an add-on)
  // Base plan items have quantity 1 and no metadata marking them as add-ons
  const basePlanItem = subscription.items.data[0];
  if (!basePlanItem) throw new Error('Subscription has no items');

  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: basePlanItem.id, price: newStripePriceId }],
    proration_behavior: 'create_prorations',
  });

  return {
    subscriptionId: updated.id,
    status: updated.status,
    currentPeriodEnd: new Date(updated.current_period_end * 1000),
  };
}

/**
 * Update the extra staff quantity on an existing subscription.
 * If no staff item exists yet, adds one. If quantity is 0, removes it.
 */
export async function updateExtraStaffQuantity(
  subscriptionId: string,
  existingItemId: string | null,
  extraStaffPriceId: string,
  quantity: number
): Promise<string | null> {
  if (quantity <= 0 && existingItemId) {
    // Remove the extra staff item
    await stripe.subscriptionItems.del(existingItemId, {
      proration_behavior: 'create_prorations',
    });
    return null;
  }

  if (quantity > 0 && existingItemId) {
    // Update quantity on existing item
    await stripe.subscriptionItems.update(existingItemId, {
      quantity,
      proration_behavior: 'create_prorations',
    });
    return existingItemId;
  }

  if (quantity > 0 && !existingItemId) {
    // Add new extra staff item to subscription
    const item = await stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: extraStaffPriceId,
      quantity,
      proration_behavior: 'create_prorations',
    });
    return item.id;
  }

  return null;
}

/**
 * Add or remove the online payments add-on from a subscription.
 */
export async function toggleOnlinePaymentsAddon(
  subscriptionId: string,
  existingItemId: string | null,
  onlinePaymentsPriceId: string,
  enable: boolean
): Promise<string | null> {
  if (enable && !existingItemId) {
    // Add online payments add-on
    const item = await stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: onlinePaymentsPriceId,
      proration_behavior: 'create_prorations',
    });
    return item.id;
  }

  if (!enable && existingItemId) {
    // Remove online payments add-on
    await stripe.subscriptionItems.del(existingItemId, {
      proration_behavior: 'create_prorations',
    });
    return null;
  }

  return existingItemId;
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
