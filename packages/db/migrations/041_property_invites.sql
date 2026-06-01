-- Tenant invite links for properties
CREATE TABLE IF NOT EXISTS property_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  accepted_by UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE property_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Property admins manage invites" ON property_invites
    FOR ALL USING (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()))
    WITH CHECK (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_invites_code ON property_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_property_invites_property ON property_invites(property_id);
