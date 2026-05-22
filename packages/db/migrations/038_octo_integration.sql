-- Phase 3: Bokun OCTO integration for OTA distribution
-- Tenants can distribute services to Viator, GetYourGuide, etc. via Bokun

-- OCTO connections per tenant
CREATE TABLE IF NOT EXISTS octo_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL DEFAULT 'bokun',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, channel_name)
);

ALTER TABLE octo_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenants manage own octo connections"
    ON octo_connections FOR ALL
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Map Balkina services to OCTO product IDs
CREATE TABLE IF NOT EXISTS octo_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES octo_connections(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  octo_product_id TEXT NOT NULL UNIQUE,
  octo_option_id TEXT NOT NULL DEFAULT 'DEFAULT',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, service_id)
);

ALTER TABLE octo_product_mappings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenants manage own octo product mappings"
    ON octo_product_mappings FOR ALL
    USING (connection_id IN (SELECT id FROM octo_connections WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())))
    WITH CHECK (connection_id IN (SELECT id FROM octo_connections WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Track OCTO booking lifecycle (ON_HOLD → CONFIRMED → CANCELLED/EXPIRED)
CREATE TABLE IF NOT EXISTS octo_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES octo_connections(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  octo_booking_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ON_HOLD' CHECK (status IN ('ON_HOLD', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
  product_mapping_id UUID NOT NULL REFERENCES octo_product_mappings(id),
  availability_id TEXT NOT NULL,
  unit_items JSONB NOT NULL DEFAULT '[]',
  contact JSONB,
  notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE octo_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenants read own octo bookings"
    ON octo_bookings FOR SELECT
    USING (connection_id IN (SELECT id FROM octo_connections WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Track booking source on appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'direct';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS octo_booking_id TEXT;
