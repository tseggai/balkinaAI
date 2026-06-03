-- Per-tenant read tracking for property messages (one row = one tenant has read
-- one message). Works for both broadcasts (shared property_messages row) and
-- individual messages.
CREATE TABLE IF NOT EXISTS property_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES property_messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, tenant_id)
);

ALTER TABLE property_message_reads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenants manage their own message reads" ON property_message_reads
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_message_reads_tenant ON property_message_reads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_message_reads_message ON property_message_reads(message_id);
