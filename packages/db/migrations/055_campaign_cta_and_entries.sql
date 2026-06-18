-- CTA behaviour + collected fields for campaigns, and customer entries (RSVPs).
ALTER TABLE property_campaigns ADD COLUMN IF NOT EXISTS cta_type text NOT NULL DEFAULT 'none'; -- none | rsvp | signup | learn_more
ALTER TABLE property_campaigns ADD COLUMN IF NOT EXISTS cta_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS campaign_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES property_campaigns(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_entries_campaign ON campaign_entries(campaign_id);

ALTER TABLE campaign_entries ENABLE ROW LEVEL SECURITY;
