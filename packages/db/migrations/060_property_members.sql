-- Property members (Phase 1): flag a property's customers as homeowners /
-- renters / commercial owners (residents) vs guests, so they can receive
-- resident-only announcements and special access.
--
-- Anchor = owner-distributed code. The property issues reusable per-type codes;
-- a signed-in customer redeems one in the app and is INSTANTLY an active member
-- of that code's type (the code is the proof — no approval queue). The owner
-- sees the member list and can revoke anyone, and rotate/expire codes.

-- ── Codes the property hands out ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_member_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  -- The membership granted on redemption.
  member_type TEXT NOT NULL DEFAULT 'homeowner'
    CHECK (member_type IN ('homeowner', 'renter', 'commercial_owner', 'guest')),
  -- Optional default unit baked into the code (e.g. a per-building code). When
  -- null the redeemer is asked for their own unit.
  unit TEXT,
  label TEXT,                       -- admin-facing note ("Homeowners 2026")
  max_redemptions INT,              -- null = unlimited
  redemption_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,           -- null = never
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── The membership flag itself ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL DEFAULT 'homeowner'
    CHECK (member_type IN ('homeowner', 'renter', 'commercial_owner', 'guest')),
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  source TEXT NOT NULL DEFAULT 'code' CHECK (source IN ('code', 'admin', 'import')),
  code_id UUID REFERENCES property_member_codes(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One membership per customer per property (re-redeeming updates type/unit).
  UNIQUE (property_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_property_member_codes_property ON property_member_codes(property_id);
CREATE INDEX IF NOT EXISTS idx_property_member_codes_code ON property_member_codes(code);
CREATE INDEX IF NOT EXISTS idx_property_members_property ON property_members(property_id);
CREATE INDEX IF NOT EXISTS idx_property_members_customer ON property_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_property_members_type ON property_members(property_id, member_type) WHERE status = 'active';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE property_member_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_members ENABLE ROW LEVEL SECURITY;

-- Codes: only property admins (privileged operations also go through the
-- service-role client, which bypasses RLS). No public read — redemption is
-- validated server-side so the code list is never exposed to customers.
DO $$ BEGIN
  CREATE POLICY "Property admins manage member codes" ON property_member_codes
    FOR ALL USING (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()))
    WITH CHECK (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Members: a customer can read their OWN membership (for the app badge);
-- property admins can read/manage all members of their property. Writes from
-- the redeem flow use the service-role client.
DO $$ BEGIN
  CREATE POLICY "Customers read own membership" ON property_members
    FOR SELECT USING (customer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Property admins manage members" ON property_members
    FOR ALL USING (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()))
    WITH CHECK (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
