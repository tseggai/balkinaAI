-- Growth: pre-provisioned ("unclaimed") tenants and claim tokens.
-- The pre-provisioner builds a hidden booking page for an enriched prospect;
-- the business claims it from the marketing site via a one-time token.

-- Unclaimed tenants are invisible to discovery and /b/<slug> (both filter status = 'active').
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'pending_subscription', 'past_due', 'unclaimed'));

ALTER TABLE growth_prospects
  ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS preprovisioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_email TEXT;

CREATE INDEX IF NOT EXISTS idx_growth_prospects_tenant ON growth_prospects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_target ON growth_prospects (search_target_id);
