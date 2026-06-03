-- Property subscription billing (property owner pays Balkina).
-- Mirrors the tenant billing columns. Per-seat billing is driven by the number
-- of linked tenants (property_tenants), tracked via stripe_seat_item_id.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS seats INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_seat_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_stripe_subscription ON properties(stripe_subscription_id);
