-- Tenant gallery: photos uploaded by tenants for customer-facing display
CREATE TABLE tenant_gallery (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_gallery ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_gallery_tenant_id ON tenant_gallery(tenant_id);

-- Tenant users can manage their own gallery
CREATE POLICY "Tenant users can manage their own gallery"
  ON tenant_gallery FOR ALL
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- Anyone can read gallery photos (public-facing for customer discovery)
CREATE POLICY "Public can read gallery photos"
  ON tenant_gallery FOR SELECT
  USING (true);
