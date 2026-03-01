/**
 * Stripe webhook handler.
 * Verifies signature, checks idempotency, and processes subscription events.
 */
import { type Request, type Response, Router } from 'express';
import { stripe } from '@balkina/billing';
import { createServerAdminClient } from '@balkina/db';
import {
  sendSubscriptionActivatedEmail,
  sendPaymentFailedEmail,
} from '@balkina/notifications';
import type Stripe from 'stripe';

export const stripeWebhookRouter = Router();

/**
 * Check if an event has already been processed (idempotency).
 */
async function isEventProcessed(supabase: ReturnType<typeof createServerAdminClient>, stripeEventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', stripeEventId)
    .single();
  return !!data;
}

/**
 * Mark an event as processed.
 */
async function markEventProcessed(supabase: ReturnType<typeof createServerAdminClient>, stripeEventId: string): Promise<void> {
  await supabase
    .from('stripe_webhook_events')
    .insert({ stripe_event_id: stripeEventId });
}

/**
 * Get tenant by Stripe customer ID.
 */
async function getTenantByCustomerId(supabase: ReturnType<typeof createServerAdminClient>, customerId: string) {
  const { data } = await supabase
    .from('tenants')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();
  return data;
}

/**
 * Get subscription plan by Stripe price ID.
 */
async function getPlanByPriceId(supabase: ReturnType<typeof createServerAdminClient>, priceId: string) {
  const { data } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('stripe_price_id', priceId)
    .single();
  return data;
}

/**
 * Handle customer.subscription.created — set tenant active and store subscription ID.
 */
async function handleSubscriptionCreated(supabase: ReturnType<typeof createServerAdminClient>, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const tenant = await getTenantByCustomerId(supabase, customerId);
  if (!tenant) return;

  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? await getPlanByPriceId(supabase, priceId) : null;

  await supabase
    .from('tenants')
    .update({
      status: 'active',
      stripe_subscription_id: subscription.id,
      subscription_plan_id: plan?.id ?? null,
    })
    .eq('id', tenant.id);

  // Send subscription confirmation email
  try {
    await sendSubscriptionActivatedEmail({
      email: tenant.email,
      ownerName: tenant.owner_name,
      businessName: tenant.name,
      planName: plan?.name ?? 'Balkina AI',
    });
  } catch {
    // Email delivery failure is non-fatal
  }
}

/**
 * Handle customer.subscription.updated — update plan.
 */
async function handleSubscriptionUpdated(supabase: ReturnType<typeof createServerAdminClient>, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const tenant = await getTenantByCustomerId(supabase, customerId);
  if (!tenant) return;

  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId ? await getPlanByPriceId(supabase, priceId) : null;

  await supabase
    .from('tenants')
    .update({
      subscription_plan_id: plan?.id ?? tenant.subscription_plan_id,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', tenant.id);
}

/**
 * Handle customer.subscription.deleted — suspend tenant.
 */
async function handleSubscriptionDeleted(supabase: ReturnType<typeof createServerAdminClient>, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const tenant = await getTenantByCustomerId(supabase, customerId);
  if (!tenant) return;

  await supabase
    .from('tenants')
    .update({ status: 'suspended' })
    .eq('id', tenant.id);
}

/**
 * Handle invoice.payment_failed — set tenant past_due and send email.
 */
async function handlePaymentFailed(supabase: ReturnType<typeof createServerAdminClient>, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const tenant = await getTenantByCustomerId(supabase, customerId);
  if (!tenant) return;

  await supabase
    .from('tenants')
    .update({ status: 'past_due' })
    .eq('id', tenant.id);

  // Send payment failure email
  try {
    await sendPaymentFailedEmail({
      email: tenant.email,
      ownerName: tenant.owner_name,
      businessName: tenant.name,
    });
  } catch {
    // Email delivery failure is non-fatal
  }
}

/**
 * Handle invoice.paid — ensure tenant is active.
 */
async function handleInvoicePaid(supabase: ReturnType<typeof createServerAdminClient>, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) return;

  const tenant = await getTenantByCustomerId(supabase, customerId);
  if (!tenant) return;

  // Only update if currently past_due
  if (tenant.status === 'past_due') {
    await supabase
      .from('tenants')
      .update({ status: 'active' })
      .eq('id', tenant.id);
  }
}

/**
 * POST /api/webhooks/stripe
 * Raw body required for signature verification.
 */
stripeWebhookRouter.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

  if (!signature || !webhookSecret) {
    res.status(400).json({ error: 'Missing signature or webhook secret' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  const supabase = createServerAdminClient();

  // Idempotency check
  const alreadyProcessed = await isEventProcessed(supabase, event.id);
  if (alreadyProcessed) {
    res.json({ received: true, status: 'already_processed' });
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(supabase, event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabase, event.data.object as Stripe.Invoice);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event type — log and acknowledge
        break;
    }

    // Mark as processed
    await markEventProcessed(supabase, event.id);

    res.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    console.error(`Webhook processing error for ${event.type}:`, message);
    res.status(500).json({ error: message });
  }
});
