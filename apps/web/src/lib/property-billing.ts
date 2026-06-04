import { getStripe, PROPERTY_SEAT_PRICE_ID, billableSeats } from '@/lib/stripe';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

export interface PropertyBillingRow {
  id: string;
  name: string;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_seat_item_id: string | null;
  subscription_status: string | null;
  tier: string | null;
  seats: number | null;
}

/** Ensure the property has a Stripe customer, creating one on first use. */
export async function getOrCreatePropertyCustomer(admin: Db, property: PropertyBillingRow): Promise<string> {
  if (property.stripe_customer_id) return property.stripe_customer_id;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: property.name,
    email: property.email || undefined,
    metadata: { property_id: property.id },
  });
  await admin.from('properties').update({ stripe_customer_id: customer.id }).eq('id', property.id);
  return customer.id;
}

/** Count the businesses currently linked to the property (the billed seats). */
export async function countPropertySeats(admin: Db, propertyId: string): Promise<number> {
  const { count } = await admin
    .from('property_tenants')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId);
  return count ?? 0;
}

/**
 * Self-healing seat sync: align the Stripe per-seat subscription item quantity
 * with the current tenant count. Safe to call after any tenant add/remove or
 * when the billing page is viewed. No-ops if the property has no active
 * subscription or no seat price is configured.
 */
export async function syncPropertySeats(admin: Db, propertyId: string): Promise<number> {
  const { data: propRow } = await admin
    .from('properties')
    .select('id, tier, stripe_subscription_id, stripe_seat_item_id')
    .eq('id', propertyId)
    .single();
  const property = propRow as { tier: string | null; stripe_subscription_id: string | null; stripe_seat_item_id: string | null } | null;
  const total = await countPropertySeats(admin, propertyId);
  // seats stores the TOTAL linked businesses (for display); the Stripe seat item
  // only bills the overage beyond the plan's included allowance.
  await admin.from('properties').update({ seats: total }).eq('id', propertyId);

  // Custom (sales-led) plans are managed manually in Stripe — don't auto-adjust.
  if (!property?.stripe_subscription_id || !PROPERTY_SEAT_PRICE_ID || property.tier === 'custom') return total;

  const billable = billableSeats(property.tier ?? 'essentials', total);
  const stripe = getStripe();
  try {
    if (property.stripe_seat_item_id) {
      if (billable > 0) {
        await stripe.subscriptionItems.update(property.stripe_seat_item_id, { quantity: billable, proration_behavior: 'none' });
      } else {
        // Dropped back within the included allowance — remove the overage item.
        await stripe.subscriptionItems.del(property.stripe_seat_item_id, { proration_behavior: 'none' });
        await admin.from('properties').update({ stripe_seat_item_id: null }).eq('id', propertyId);
      }
    } else if (billable > 0) {
      const item = await stripe.subscriptionItems.create({
        subscription: property.stripe_subscription_id,
        price: PROPERTY_SEAT_PRICE_ID,
        quantity: billable,
        proration_behavior: 'none',
      });
      await admin.from('properties').update({ stripe_seat_item_id: item.id }).eq('id', propertyId);
    }
  } catch (err) {
    console.error('[property-billing] seat sync failed:', err instanceof Error ? err.message : err);
  }
  return total;
}
