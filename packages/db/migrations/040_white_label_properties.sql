-- White-label property infrastructure
-- Properties are groups of tenants (e.g. Porto Montenegro, Santana Row)
-- Each property can have a branded web portal and/or a native app

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  icon_url TEXT,
  splash_url TEXT,
  description TEXT,
  welcome_message TEXT DEFAULT 'What would you like to book today?',

  -- Branding
  primary_color TEXT DEFAULT '#6B7FC4',
  secondary_color TEXT DEFAULT '#4338ca',
  background_color TEXT DEFAULT '#ffffff',

  -- Contact
  website TEXT,
  email TEXT,
  phone TEXT,

  -- Location
  address TEXT,
  city TEXT,
  country TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  radius_km NUMERIC DEFAULT 5,

  -- App Store (for Option C)
  bundle_id TEXT,
  app_store_url TEXT,
  play_store_url TEXT,

  -- Portal (for Option B)
  custom_domain TEXT,

  -- Settings
  tier TEXT NOT NULL DEFAULT 'essentials' CHECK (tier IN ('essentials', 'premium')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link tenants to properties (many-to-many, a tenant can be in multiple properties)
CREATE TABLE IF NOT EXISTS property_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_order INT DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, tenant_id)
);

-- Property admins (who manages the property portal)
CREATE TABLE IF NOT EXISTS property_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, user_id)
);

-- RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_admins ENABLE ROW LEVEL SECURITY;

-- Public read for active properties (needed for the web portal)
DO $$ BEGIN
  CREATE POLICY "Public read active properties" ON properties
    FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Public read property tenants" ON property_tenants
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Property admins manage own" ON properties
    FOR ALL USING (id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()))
    WITH CHECK (id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Property admins manage tenants" ON property_tenants
    FOR ALL USING (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()))
    WITH CHECK (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Property admins manage admins" ON property_admins
    FOR ALL USING (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid() AND role = 'admin'))
    WITH CHECK (property_id IN (SELECT property_id FROM property_admins WHERE user_id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_tenants_property ON property_tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_property_tenants_tenant ON property_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_admins_user ON property_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_slug ON properties(slug);
