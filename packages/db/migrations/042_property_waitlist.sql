-- Associate a waitlist signup with the property that invited it.
-- When a business signs up through a property's invite link (/join?property_invite=CODE),
-- the resulting waitlist row is tagged with property_id so the property owner can
-- review and approve it from their dashboard (instead of the platform admin).
ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_invite_id UUID REFERENCES property_invites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_property ON waitlist(property_id);

-- Allow property admins to read/manage the waitlist entries that belong to their property.
DO $$ BEGIN
  CREATE POLICY "Property admins read their waitlist" ON waitlist
    FOR SELECT USING (
      property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
