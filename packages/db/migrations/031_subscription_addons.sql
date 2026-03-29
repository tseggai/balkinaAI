-- Migration: Add subscription add-on support
-- Tracks per-plan extra staff pricing and online payments add-on

-- Add extra staff pricing to subscription_plans (varies by plan: $8 for Team, $6 for Scale)
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS extra_staff_price NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extra_staff_stripe_price_id TEXT DEFAULT NULL;

-- Add online payments add-on Stripe price ID (global, stored on tenants since it's a per-tenant toggle)
-- payments_enabled already exists from migration 025
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS online_payments_stripe_item_id TEXT DEFAULT NULL;

-- Track Stripe subscription item IDs for managing quantities
-- This lets us update staff quantity without recreating the subscription
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_extra_staff_item_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extra_staff_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN subscription_plans.extra_staff_price IS 'Monthly price per additional staff member beyond max_staff (e.g., $8 for Team, $6 for Scale)';
COMMENT ON COLUMN subscription_plans.extra_staff_stripe_price_id IS 'Stripe Price ID for the additional staff flat-rate product';
COMMENT ON COLUMN tenants.stripe_extra_staff_item_id IS 'Stripe SubscriptionItem ID for the extra staff line item';
COMMENT ON COLUMN tenants.online_payments_stripe_item_id IS 'Stripe SubscriptionItem ID for the online payments add-on';
COMMENT ON COLUMN tenants.extra_staff_count IS 'Number of additional staff beyond plan max_staff';
