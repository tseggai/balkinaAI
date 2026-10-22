-- Migration 073: Canva connection + brand-template registry for the Instagram studio, and a public bucket for renders.
-- Service-role only tables (RLS on, no policies).

CREATE TABLE IF NOT EXISTS canva_connection (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token   TEXT NOT NULL,
  refresh_token  TEXT NOT NULL,                 -- rotates on every refresh
  expires_at     TIMESTAMPTZ NOT NULL,
  scope          TEXT,
  user_id        TEXT,
  team_id        TEXT,
  connected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ig_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_template_id  TEXT NOT NULL UNIQUE,      -- Canva brand template id
  title              TEXT NOT NULL,             -- e.g. "IG · 01 card · square"
  layout             TEXT NOT NULL,             -- card | split | framed | circle | column | steps | cta | stat
  format             TEXT NOT NULL CHECK (format IN ('sq', 'st')),
  fields             JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { name: 'text' | 'image' | 'chart' | 'sheet' }
  thumbnail_url      TEXT,
  last_render_url    TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ig_templates_layout_format ON ig_templates (layout, format);

ALTER TABLE canva_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_templates ENABLE ROW LEVEL SECURITY;

-- Public bucket for rendered JPEGs (Instagram fetches images by public URL).
INSERT INTO storage.buckets (id, name, public)
VALUES ('ig-renders', 'ig-renders', true)
ON CONFLICT (id) DO NOTHING;
