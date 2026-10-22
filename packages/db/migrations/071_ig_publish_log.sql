-- Migration 071: Instagram publisher log
-- One row per planned feed post / story. The cron at /api/growth/cron/instagram upserts a row
-- before publishing and fills ig_media_id + published_at on success, so a re-run never posts twice.
-- Service-role only (no RLS policies → anon/authenticated cannot read it).

CREATE TABLE IF NOT EXISTS ig_publish_log (
  key             TEXT PRIMARY KEY,                     -- e.g. set1/09-photo-barber/feed
  kind            TEXT NOT NULL CHECK (kind IN ('feed', 'story')),
  set_no          SMALLINT NOT NULL,
  file            TEXT NOT NULL,
  scheduled_for   DATE NOT NULL,
  image_url       TEXT NOT NULL,
  caption         TEXT,
  ig_container_id TEXT,
  ig_media_id     TEXT,
  published_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ig_publish_log_scheduled ON ig_publish_log (scheduled_for);

ALTER TABLE ig_publish_log ENABLE ROW LEVEL SECURITY;
