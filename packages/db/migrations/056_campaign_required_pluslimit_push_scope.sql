-- Required RSVP fields + plus-one limit.
ALTER TABLE property_campaigns ADD COLUMN IF NOT EXISTS cta_required jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE property_campaigns ADD COLUMN IF NOT EXISTS cta_plus_one_limit integer;

-- Scope push tokens to the app they were registered from, so property campaigns
-- only notify that property's app (not the base Balkina app).
ALTER TABLE customer_push_tokens ADD COLUMN IF NOT EXISTS property_slug text;
CREATE INDEX IF NOT EXISTS idx_customer_push_tokens_property ON customer_push_tokens(property_slug);
