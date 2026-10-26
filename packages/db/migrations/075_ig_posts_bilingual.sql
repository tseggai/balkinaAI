-- Migration 075: studio posts render both languages, feed goes out as an SR→EN carousel,
-- stories as two consecutive stories; batches group posts generated together.

ALTER TABLE ig_posts
  ADD COLUMN IF NOT EXISTS langs              TEXT[] NOT NULL DEFAULT ARRAY['sr', 'en'],   -- languages to render + post; `lang` stays the primary (first slide / first story)
  ADD COLUMN IF NOT EXISTS renders            JSONB NOT NULL DEFAULT '{}'::jsonb,          -- { "sq": { "sr": url, "en": url }, "st": { "sr": url, "en": url } }
  ADD COLUMN IF NOT EXISTS designs            JSONB NOT NULL DEFAULT '{}'::jsonb,          -- same shape, Canva design ids
  ADD COLUMN IF NOT EXISTS story2_media_id    TEXT,                                        -- the second-language story
  ADD COLUMN IF NOT EXISTS story2_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS batch_id           UUID;

CREATE INDEX IF NOT EXISTS idx_ig_posts_batch ON ig_posts (batch_id);
