-- =============================================================================
-- Migration: 001_initial_schema.sql
-- Balkina AI — Full initial database schema
-- =============================================================================
-- Run against your Supabase project:
--   supabase db push  (or paste into Supabase SQL editor)
-- =============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── Helper: updated_at trigger function ─────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLE: subscription_plans
-- Global plans managed by platform admin. No tenant_id — platform-wide.
-- =============================================================================

CREATE TABLE subscription_plans (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT        NOT NULL,
  price_monthly   NUMERIC(10,2) NOT NULL CHECK (price_monthly >= 0),
  stripe_price_id TEXT        UNIQUE,
  max_staff       INTEGER     NOT NULL DEFAULT 5  CHECK (max_staff > 0),
  max_locations   INTEGER     NOT NULL DEFAULT 1  CHECK (max_locations > 0),
  features        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- ─── Seed default plans ──────────────────────────────────────────────────────
INSERT INTO subscription_plans (name, price_monthly, max_staff, max_locations, features)
VALUES
  ('Starter',    29.00,   3,  1, '{"ai_chat": true, "sms": false, "analytics": false}'::jsonb),
  ('Pro',        79.00,  10,  3, '{"ai_chat": true, "sms": true,  "analytics": true}'::jsonb),
  ('Enterprise', 199.00, 50, 10, '{"ai_chat": true, "sms": true,  "analytics": true, "white_label": true}'::jsonb);


-- =============================================================================
-- TABLE: tenants
-- =============================================================================

CREATE TABLE tenants (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  TEXT        NOT NULL,
  stripe_customer_id    TEXT        UNIQUE,
  stripe_account_id     TEXT        UNIQUE,
  subscription_plan_id  UUID        REFERENCES subscription_plans(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Index: used in every tenant-scoped query
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_stripe_customer_id ON tenants(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;


-- =============================================================================
-- TABLE: tenant_locations
-- =============================================================================

CREATE TABLE tenant_locations (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  address     TEXT        NOT NULL,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  timezone    TEXT        NOT NULL DEFAULT 'UTC',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_locations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_locations_tenant_id ON tenant_locations(tenant_id);
-- PostGIS spatial index for geo-search queries
CREATE INDEX idx_tenant_locations_geom
  ON tenant_locations USING GIST (ST_MakePoint(lng, lat))
  WHERE lat IS NOT NULL AND lng IS NOT NULL;


-- =============================================================================
-- TABLE: staff
-- =============================================================================

CREATE TABLE staff (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  email                 TEXT        NOT NULL,
  phone                 TEXT,
  availability_schedule JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_staff_tenant_id ON staff(tenant_id);


-- =============================================================================
-- TABLE: categories
-- Global taxonomy — admin-managed, shared across all tenants.
-- =============================================================================

CREATE TABLE categories (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id     UUID        REFERENCES categories(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  icon_url      TEXT,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_categories_parent_id ON categories(parent_id)
  WHERE parent_id IS NOT NULL;
CREATE INDEX idx_categories_display_order ON categories(display_order);


-- =============================================================================
-- TABLE: services
-- =============================================================================

CREATE TABLE services (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id      UUID        REFERENCES categories(id) ON DELETE SET NULL,
  name             TEXT        NOT NULL,
  duration_minutes INTEGER     NOT NULL CHECK (duration_minutes > 0),
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  deposit_enabled  BOOLEAN     NOT NULL DEFAULT false,
  deposit_type     TEXT        CHECK (deposit_type IN ('fixed', 'percentage')),
  deposit_amount   NUMERIC(10,2) CHECK (deposit_amount >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deposit_consistent
    CHECK (
      (deposit_enabled = false)
      OR (deposit_enabled = true AND deposit_type IS NOT NULL AND deposit_amount IS NOT NULL)
    )
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_services_tenant_id ON services(tenant_id);
CREATE INDEX idx_services_category_id ON services(category_id)
  WHERE category_id IS NOT NULL;


-- =============================================================================
-- TABLE: service_extras
-- =============================================================================

CREATE TABLE service_extras (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id       UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  duration_minutes INTEGER     NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE service_extras ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_service_extras_service_id ON service_extras(service_id);


-- =============================================================================
-- TABLE: customers
-- References auth.users — one row per registered mobile app user.
-- =============================================================================

CREATE TABLE customers (
  id                       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name             TEXT,
  phone                    TEXT,
  email                    TEXT,
  push_token               TEXT,
  location_sharing_enabled BOOLEAN     NOT NULL DEFAULT false,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- No separate idx needed on id (primary key). Index for phone lookups:
CREATE INDEX idx_customers_phone ON customers(phone)
  WHERE phone IS NOT NULL;


-- =============================================================================
-- TABLE: appointments
-- =============================================================================

CREATE TABLE appointments (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id             UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  tenant_id               UUID        NOT NULL REFERENCES tenants(id)   ON DELETE RESTRICT,
  service_id              UUID        NOT NULL REFERENCES services(id)  ON DELETE RESTRICT,
  staff_id                UUID        REFERENCES staff(id)             ON DELETE SET NULL,
  location_id             UUID        REFERENCES tenant_locations(id)  ON DELETE SET NULL,
  start_time              TIMESTAMPTZ NOT NULL,
  end_time                TIMESTAMPTZ NOT NULL,
  status                  TEXT        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  total_price             NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  deposit_paid            BOOLEAN     NOT NULL DEFAULT false,
  deposit_amount_paid     NUMERIC(10,2) CHECK (deposit_amount_paid >= 0),
  balance_due             NUMERIC(10,2) CHECK (balance_due >= 0),
  stripe_payment_intent_id TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_appointments_customer_id  ON appointments(customer_id);
CREATE INDEX idx_appointments_tenant_id    ON appointments(tenant_id);
CREATE INDEX idx_appointments_staff_id     ON appointments(staff_id)  WHERE staff_id IS NOT NULL;
CREATE INDEX idx_appointments_start_time   ON appointments(start_time);
CREATE INDEX idx_appointments_status       ON appointments(status);
-- Composite: tenant dashboard — list upcoming appointments
CREATE INDEX idx_appointments_tenant_start ON appointments(tenant_id, start_time);


-- =============================================================================
-- TABLE: customer_behavior_profiles
-- =============================================================================

CREATE TABLE customer_behavior_profiles (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id         UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id           UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  service_id          UUID        NOT NULL REFERENCES services(id)  ON DELETE CASCADE,
  avg_interval_days   NUMERIC(6,2),
  last_booking_date   DATE,
  predicted_next_date DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, tenant_id, service_id)
);

ALTER TABLE customer_behavior_profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cbp_customer_id ON customer_behavior_profiles(customer_id);
CREATE INDEX idx_cbp_tenant_id   ON customer_behavior_profiles(tenant_id);
-- For AI nudge queries: find customers due for rebooking at a tenant
CREATE INDEX idx_cbp_predicted_next ON customer_behavior_profiles(tenant_id, predicted_next_date)
  WHERE predicted_next_date IS NOT NULL;


-- =============================================================================
-- TABLE: coupons
-- =============================================================================

CREATE TABLE coupons (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code           TEXT        NOT NULL,
  discount_type  TEXT        NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  expires_at     TIMESTAMPTZ,
  usage_count    INTEGER     NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  usage_limit    INTEGER     CHECK (usage_limit > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_coupons_tenant_id ON coupons(tenant_id);
CREATE INDEX idx_coupons_code      ON coupons(tenant_id, code);


-- =============================================================================
-- TABLE: reviews
-- =============================================================================

CREATE TABLE reviews (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID        NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id    UUID        NOT NULL REFERENCES customers(id),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id),
  staff_id       UUID        REFERENCES staff(id) ON DELETE SET NULL,
  rating         INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_reviews_customer_id ON reviews(customer_id);
CREATE INDEX idx_reviews_tenant_id   ON reviews(tenant_id);
CREATE INDEX idx_reviews_staff_id    ON reviews(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_reviews_rating      ON reviews(tenant_id, rating);


-- =============================================================================
-- TABLE: ai_nudge_log
-- =============================================================================

CREATE TABLE ai_nudge_log (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  trigger_type TEXT        NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at    TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

ALTER TABLE ai_nudge_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_nudge_log_customer_id ON ai_nudge_log(customer_id);
CREATE INDEX idx_ai_nudge_log_tenant_id   ON ai_nudge_log(tenant_id);
CREATE INDEX idx_ai_nudge_log_sent_at     ON ai_nudge_log(sent_at);


-- =============================================================================
-- TABLE: stripe_webhook_events
-- Idempotency table — prevents duplicate processing of Stripe webhooks.
-- =============================================================================

CREATE TABLE stripe_webhook_events (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT        NOT NULL UNIQUE,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Fast lookup by stripe_event_id for idempotency check
CREATE INDEX idx_stripe_webhook_events_event_id ON stripe_webhook_events(stripe_event_id);
