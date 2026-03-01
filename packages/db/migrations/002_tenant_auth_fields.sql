-- =============================================================================
-- Migration: 002_tenant_auth_fields.sql
-- Adds auth-related columns to tenants table for Phase 2.
-- =============================================================================

-- Add new columns to tenants
ALTER TABLE tenants
  ADD COLUMN user_id              UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN owner_name           TEXT        NOT NULL DEFAULT '',
  ADD COLUMN email                TEXT        NOT NULL DEFAULT '',
  ADD COLUMN phone                TEXT,
  ADD COLUMN category_id          UUID        REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN stripe_subscription_id TEXT      UNIQUE;

-- Update status check constraint to include new statuses
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'pending_subscription', 'past_due'));

-- Index for user_id lookups (tenant by auth user)
CREATE UNIQUE INDEX idx_tenants_user_id ON tenants(user_id) WHERE user_id IS NOT NULL;

-- Index for category_id
CREATE INDEX idx_tenants_category_id ON tenants(category_id) WHERE category_id IS NOT NULL;

-- Index for subscription lookups
CREATE INDEX idx_tenants_stripe_subscription_id ON tenants(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
