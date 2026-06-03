import Stripe from 'stripe';

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required');
  return new Stripe(key, {
    apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion,
    typescript: true,
  });
}

export const PLAN_PRICE_IDS = {
  solo_pro: process.env.STRIPE_PRICE_ID_SOLO_PRO ?? '',
  team: process.env.STRIPE_PRICE_ID_TEAM ?? '',
  scale: process.env.STRIPE_PRICE_ID_SCALE ?? '',
} as const;

export const ADDON_PRICE_IDS = {
  extra_staff: process.env.STRIPE_PRICE_ID_EXTRA_STAFF ?? '',
  online_payments: process.env.STRIPE_PRICE_ID_ONLINE_PAYMENTS ?? '',
} as const;

// White-label property plans (property owner pays Balkina) + per-seat add-on.
export const PROPERTY_PLAN_PRICE_IDS = {
  essentials: process.env.STRIPE_PRICE_ID_PROPERTY_ESSENTIALS ?? '',
  premium: process.env.STRIPE_PRICE_ID_PROPERTY_PREMIUM ?? '',
} as const;

export const PROPERTY_SEAT_PRICE_ID = process.env.STRIPE_PRICE_ID_PROPERTY_SEAT ?? '';

export type PlanKey = keyof typeof PLAN_PRICE_IDS;
export type AddonKey = keyof typeof ADDON_PRICE_IDS;
export type PropertyPlanKey = keyof typeof PROPERTY_PLAN_PRICE_IDS;
