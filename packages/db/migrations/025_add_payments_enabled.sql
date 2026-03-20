-- Migration 025: Add payments_enabled flag to tenants table
-- When false, deposit collection, Stripe Connect payments, and checkout are disabled.
-- Used for launching in regions where Stripe is not available.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS payments_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN tenants.payments_enabled IS 'When false, deposit collection and app-based payments are disabled (e.g. regions without Stripe).';
