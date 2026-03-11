-- ============================================================================
-- 009: Fix schema mismatches for coupons, loyalty, inventory
-- ============================================================================

-- ── Coupons: add missing columns ──────────────────────────────────────────
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_lifetime boolean DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS scope text DEFAULT 'per_booking';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_service_ids uuid[] DEFAULT NULL;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_staff_ids uuid[] DEFAULT NULL;

-- ── Loyalty programs: add missing columns ─────────────────────────────────
-- The frontend uses 'redemption_rate' but the DB has 'points_to_currency_rate'
ALTER TABLE loyalty_programs ADD COLUMN IF NOT EXISTS redemption_rate numeric(10,4) DEFAULT 0;

-- Backfill redemption_rate from existing points_to_currency_rate where possible
UPDATE loyalty_programs SET redemption_rate = CASE
  WHEN points_to_currency_rate > 0 THEN 1.0 / points_to_currency_rate
  ELSE 0
END WHERE redemption_rate = 0 AND points_to_currency_rate > 0;

-- ── Loyalty rules: add tenant_id, type, target_id, points columns ─────────
-- The API uses these columns but the original schema has different names
ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE loyalty_rules ADD COLUMN IF NOT EXISTS points integer DEFAULT 0;

-- Backfill type from rule_type
UPDATE loyalty_rules SET type = rule_type WHERE type IS NULL AND rule_type IS NOT NULL;

-- ── Inventory (product_services): add quantity_per_service alias ──────────
-- The API uses 'quantity_per_service' but the DB has 'quantity_used'
ALTER TABLE product_services ADD COLUMN IF NOT EXISTS quantity_per_service integer DEFAULT 1;

-- Backfill from quantity_used
UPDATE product_services SET quantity_per_service = quantity_used WHERE quantity_per_service = 1 AND quantity_used != 1;

-- ── Customers: add user_id for auth linkage ───────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- ── Tenant locations: add phone, description, image_url ───────────────────
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS image_url text;
