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

export type PlanKey = keyof typeof PLAN_PRICE_IDS;
export type AddonKey = keyof typeof ADDON_PRICE_IDS;
