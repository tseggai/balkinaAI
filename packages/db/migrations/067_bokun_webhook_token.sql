-- Per-tenant secret for the inbound Bokun webhook. The tenant pastes
-- /api/webhooks/bokun?t=<token> into Bokun; the route only accepts deliveries
-- whose token matches, and scopes all writes to that tenant.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS bokun_webhook_token TEXT
  DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

UPDATE tenants
SET bokun_webhook_token = encode(extensions.gen_random_bytes(16), 'hex')
WHERE bokun_webhook_token IS NULL;

ALTER TABLE tenants ALTER COLUMN bokun_webhook_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_bokun_webhook_token ON tenants (bokun_webhook_token);
