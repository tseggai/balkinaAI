-- Migration 074: Instagram studio posts — copy written by GPT-4o-mini, rendered through Canva brand
-- templates (Migration 073), scheduled or posted now, published by the same cron as the 40-post plan.
-- Service-role only (RLS on, no policies).

CREATE TABLE IF NOT EXISTS ig_posts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed', 'cancelled')),
  vertical           TEXT NOT NULL,                 -- salon | barber | nails | … (studio catalogue)
  tone               TEXT NOT NULL,                 -- friendly | bold | premium | playful | calm
  lang               TEXT NOT NULL CHECK (lang IN ('sr', 'en')),   -- language rendered on the image
  layout             TEXT NOT NULL,                 -- card | split | framed | … (ig_templates.layout)
  brief              TEXT,                          -- optional free-text brief given to the copywriter
  copy               JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { sr: { eyebrow, headline, … }, en: { … } }
  caption            TEXT,                          -- final feed caption (editable)
  photo_url          TEXT NOT NULL,                 -- public URL of the photo placed in the template
  template_sq_id     UUID REFERENCES ig_templates(id) ON DELETE SET NULL,
  template_st_id     UUID REFERENCES ig_templates(id) ON DELETE SET NULL,
  render_sq_url      TEXT,
  render_st_url      TEXT,
  design_sq_id       TEXT,                          -- Canva design ids, for opening the render in Canva
  design_st_id       TEXT,
  kinds              TEXT[] NOT NULL DEFAULT ARRAY['feed', 'story'],
  scheduled_at       TIMESTAMPTZ,
  feed_media_id      TEXT,
  feed_published_at  TIMESTAMPTZ,
  story_media_id     TEXT,
  story_published_at TIMESTAMPTZ,
  error              TEXT,
  attempts           INT NOT NULL DEFAULT 0,
  attempted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ig_posts_due ON ig_posts (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ig_posts_created ON ig_posts (created_at DESC);

ALTER TABLE ig_posts ENABLE ROW LEVEL SECURITY;
