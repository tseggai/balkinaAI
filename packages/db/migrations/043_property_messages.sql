-- Property → tenant messaging & broadcasts.
-- A property owner can message all of their tenants (broadcast, tenant_id NULL)
-- or an individual tenant. Each send is recorded for history.
CREATE TABLE IF NOT EXISTS property_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL, -- NULL = broadcast to all tenants
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  recipients_count INT NOT NULL DEFAULT 0,
  email_sent_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE property_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Property admins manage messages" ON property_messages
    FOR ALL USING (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()))
    WITH CHECK (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_messages_property ON property_messages(property_id, created_at DESC);
