-- Growth engine (see docs/GTM_GROWTH_PLAN.md).
-- Prospect lists, contacts, outreach sequences, events and ad metrics for
-- both the tenant (SMB) and property (white-label) funnels.
-- All tables are service-role only: they are written by the admin panel and
-- by scheduled Routines; no anon/authenticated policies.

-- ─── Search targets: the vertical × city matrix the prospector runs ──────────
CREATE TABLE IF NOT EXISTS growth_search_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL DEFAULT 'tenant' CHECK (segment IN ('tenant', 'property')),
  vertical TEXT NOT NULL,              -- e.g. hair_salon, barber, massage
  query TEXT NOT NULL,                 -- local-language text query, e.g. 'frizerski salon'
  city TEXT NOT NULL,
  country TEXT NOT NULL,               -- ISO 3166-1 alpha-2, lower case (rs, me, hr)
  language TEXT NOT NULL DEFAULT 'sr', -- Places languageCode
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5, -- 1 = run first
  last_run_at TIMESTAMPTZ,
  last_results INTEGER,
  total_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segment, vertical, city, country)
);
ALTER TABLE growth_search_targets ENABLE ROW LEVEL SECURITY;

-- ─── Prospects: one row per business or property ─────────────────────────────
CREATE TABLE IF NOT EXISTS growth_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL DEFAULT 'tenant' CHECK (segment IN ('tenant', 'property')),
  vertical TEXT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  website TEXT,
  instagram TEXT,
  phone TEXT,
  email TEXT,
  google_place_id TEXT UNIQUE,
  google_maps_url TEXT,
  google_rating NUMERIC(2,1),
  google_review_count INTEGER,
  google_types TEXT[],
  business_status TEXT,
  source TEXT NOT NULL DEFAULT 'google_places',
  search_target_id UUID REFERENCES growth_search_targets(id) ON DELETE SET NULL,
  icp_score INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN (
    'new', 'enriched', 'qualified', 'disqualified', 'preprovisioned',
    'contacted', 'replied', 'claimed', 'signed_up', 'customer', 'lost'
  )),
  enrichment JSONB NOT NULL DEFAULT '{}'::jsonb, -- extracted services, hours, owner, socials
  notes TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL, -- set when pre-provisioned/claimed
  enriched_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_segment_stage ON growth_prospects (segment, stage);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_geo ON growth_prospects (country, city);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_score ON growth_prospects (icp_score DESC);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_vertical ON growth_prospects (vertical);
ALTER TABLE growth_prospects ENABLE ROW LEVEL SECURITY;

-- ─── Contacts: people at a prospect ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES growth_prospects(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  language TEXT NOT NULL DEFAULT 'sr',
  source TEXT,                         -- website, instagram, apollo, hunter, linkedin, manual
  consent_basis TEXT NOT NULL DEFAULT 'legitimate_interest_b2b',
  verified_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_growth_contacts_prospect ON growth_contacts (prospect_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_contacts_email ON growth_contacts (lower(email)) WHERE email IS NOT NULL;
ALTER TABLE growth_contacts ENABLE ROW LEVEL SECURITY;

-- ─── Sequences and enrollments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS growth_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('tenant', 'property')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ day: 0, channel: 'email', template: 'tenant_page_ready_1' }, ...]
  requires_approval BOOLEAN NOT NULL DEFAULT true, -- first-week gate; flip off once proven
  daily_cap INTEGER NOT NULL DEFAULT 50,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE growth_sequences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS growth_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES growth_sequences(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES growth_prospects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES growth_contacts(id) ON DELETE SET NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending_approval', 'active', 'paused', 'replied', 'bounced', 'unsubscribed', 'converted', 'finished'
  )),
  drafts JSONB NOT NULL DEFAULT '{}'::jsonb, -- step index -> personalised subject/body awaiting approval
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, prospect_id)
);
CREATE INDEX IF NOT EXISTS idx_growth_enrollments_due ON growth_enrollments (status, next_send_at);
ALTER TABLE growth_enrollments ENABLE ROW LEVEL SECURITY;

-- ─── Events: every send, open, click, reply, claim, signup ───────────────────
CREATE TABLE IF NOT EXISTS growth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES growth_prospects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES growth_contacts(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES growth_enrollments(id) ON DELETE SET NULL,
  type TEXT NOT NULL,                  -- sent, delivered, opened, clicked, replied, bounced, unsubscribed, claimed, signed_up, demo_booked, note
  channel TEXT,                        -- email, sms, linkedin, instagram, phone
  provider_id TEXT,                    -- e.g. Resend email id, for webhook idempotency
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_growth_events_prospect ON growth_events (prospect_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_events_provider ON growth_events (type, provider_id) WHERE provider_id IS NOT NULL;
ALTER TABLE growth_events ENABLE ROW LEVEL SECURITY;

-- ─── Ad metrics: one row per platform × campaign × ad set × day ──────────────
CREATE TABLE IF NOT EXISTS growth_ad_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,              -- meta, google, tiktok, linkedin, youtube
  segment TEXT NOT NULL CHECK (segment IN ('tenant', 'property')),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  day DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  activations INTEGER NOT NULL DEFAULT 0,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, campaign_id, adset_id, day)
);
ALTER TABLE growth_ad_metrics ENABLE ROW LEVEL SECURITY;

-- ─── Seed: tenant search matrix for the first geography ──────────────────────
-- Serbia (sr), Montenegro (sr), Croatia (hr). Edit from Admin → Growth → Targets.
INSERT INTO growth_search_targets (segment, vertical, query, city, country, language, priority)
SELECT 'tenant', v.vertical, v.query, c.city, c.country, c.language, v.priority
FROM (VALUES
  ('hair_salon',     'frizerski salon',          1),
  ('barber',         'barber shop',              1),
  ('nail_studio',    'nail studio manikir',      1),
  ('lash_brow',      'lash studio trepavice',    2),
  ('beauty_clinic',  'kozmetički salon',         2),
  ('massage',        'masaža',                   2),
  ('spa',            'spa centar',               3),
  ('physio',         'fizioterapija',            2),
  ('dentist',        'stomatolog',               3),
  ('trainer',        'personalni trener',        3),
  ('yoga_pilates',   'joga pilates studio',      3),
  ('gym',            'teretana',                 4),
  ('tour_operator',  'izleti ture turistička agencija', 2),
  ('boat_tour',      'boat tour',                2),
  ('restaurant',     'restoran',                 4),
  ('cafe',           'kafić',                    5)
) AS v(vertical, query, priority)
CROSS JOIN (VALUES
  ('Beograd',      'rs', 'sr'),
  ('Novi Sad',     'rs', 'sr'),
  ('Niš',          'rs', 'sr'),
  ('Kragujevac',   'rs', 'sr'),
  ('Podgorica',    'me', 'sr'),
  ('Budva',        'me', 'sr'),
  ('Kotor',        'me', 'sr'),
  ('Tivat',        'me', 'sr'),
  ('Herceg Novi',  'me', 'sr'),
  ('Bar',          'me', 'sr'),
  ('Zagreb',       'hr', 'hr'),
  ('Split',        'hr', 'hr'),
  ('Dubrovnik',    'hr', 'hr'),
  ('Zadar',        'hr', 'hr'),
  ('Rijeka',       'hr', 'hr')
) AS c(city, country, language)
WHERE NOT EXISTS (SELECT 1 FROM growth_search_targets);

-- Coastal-only verticals make little sense inland: disable boat tours there.
UPDATE growth_search_targets
SET enabled = false
WHERE vertical = 'boat_tour' AND city IN ('Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Podgorica', 'Zagreb');
