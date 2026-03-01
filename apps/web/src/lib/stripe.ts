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
  starter: process.env.STRIPE_PRICE_ID_STARTER ?? '',
  pro: process.env.STRIPE_PRICE_ID_PRO ?? '',
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE ?? '',
} as const;

export type PlanKey = keyof typeof PLAN_PRICE_IDS;
