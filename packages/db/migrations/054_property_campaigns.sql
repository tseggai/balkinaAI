-- Property campaigns: promotions/events/contests a property runs, optionally
-- with participating tenants. Shown above the categories in the customer app.
CREATE TABLE IF NOT EXISTS property_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title text NOT NULL,
  blurb text,
  description text,
  image_url text,
  campaign_type text NOT NULL DEFAULT 'promotion', -- promotion | event | contest | other
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  is_property_only boolean NOT NULL DEFAULT true,
  cta_label text,
  cta_url text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES property_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (campaign_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_property_campaigns_property ON property_campaigns(property_id);
CREATE INDEX IF NOT EXISTS idx_campaign_tenants_campaign ON campaign_tenants(campaign_id);

ALTER TABLE property_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active campaigns" ON property_campaigns
  FOR SELECT USING (is_active = true);
CREATE POLICY "Public read campaign tenants" ON campaign_tenants
  FOR SELECT USING (true);
