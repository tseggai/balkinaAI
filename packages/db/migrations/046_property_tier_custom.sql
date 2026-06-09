-- Allow a 'custom' (sales-led / negotiated) property plan alongside the
-- self-serve essentials/premium tiers.
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_tier_check;
ALTER TABLE properties ADD CONSTRAINT properties_tier_check
  CHECK (tier IN ('essentials', 'premium', 'custom'));
