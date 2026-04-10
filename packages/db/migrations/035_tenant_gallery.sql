-- Update gallery from per-tenant to per-location.
-- Each location can have up to 15 gallery photos.

-- Drop the old tenant-level gallery table
DROP TABLE IF EXISTS tenant_gallery;

-- Create location-level gallery table
CREATE TABLE location_gallery (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES tenant_locations(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE location_gallery ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_location_gallery_location_id ON location_gallery(location_id);
CREATE INDEX idx_location_gallery_tenant_id ON location_gallery(tenant_id);

-- Tenant users can manage their own gallery
CREATE POLICY "Tenant users can manage their own gallery"
  ON location_gallery FOR ALL
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- Anyone can read gallery photos (public-facing for customer discovery)
CREATE POLICY "Public can read gallery photos"
  ON location_gallery FOR SELECT
  USING (true);
