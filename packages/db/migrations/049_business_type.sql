-- Restaurant vocabulary (Migration 049).
-- Tenant business_type selects the LABELS vocabulary pack (/packages/shared)
-- and the AI chat vocabulary. Data model stays canonical; only wording changes.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_business_type_check;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_business_type_check
  CHECK (business_type IN ('standard', 'restaurant'));
