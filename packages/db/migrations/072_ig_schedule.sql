-- Migration 072: Instagram schedule settings + per-row overrides, and a 15-minute pg_cron trigger.
-- Scheduling moves from env/vercel.json into the DB so the admin page can change cadence, time,
-- and individual rows. The publisher endpoint accepts either GROWTH_CRON_SECRET or ig_settings.cron_secret.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS ig_settings (
  id           SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  start_date   DATE,                                      -- first posting day (any weekday)
  post_time    TEXT NOT NULL DEFAULT '18:00',             -- local HH:MM
  days         SMALLINT[] NOT NULL DEFAULT '{1,3,5}',     -- ISO weekdays 1=Mon … 7=Sun
  timezone     TEXT NOT NULL DEFAULT 'Europe/Podgorica',
  paused       BOOLEAN NOT NULL DEFAULT false,
  cron_secret  TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO ig_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ig_overrides (
  key           TEXT PRIMARY KEY,                         -- set1/09-photo-barber
  scheduled_at  TIMESTAMPTZ,                              -- null = follow the plan cadence
  enabled       BOOLEAN NOT NULL DEFAULT true,            -- false = skip this row
  kinds         TEXT[] NOT NULL DEFAULT '{feed,story}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ig_publish_log ADD COLUMN IF NOT EXISTS attempts SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE ig_publish_log ADD COLUMN IF NOT EXISTS attempted_at TIMESTAMPTZ;

ALTER TABLE ig_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_overrides ENABLE ROW LEVEL SECURITY;

-- Every 15 minutes: ask the admin app to publish anything that is due. Idempotent on the app side.
SELECT cron.schedule(
  'ig-publisher',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://admin.balkina.ai/api/growth/cron/instagram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT cron_secret FROM public.ig_settings WHERE id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Attempt counter bump used by the runner before each publish attempt.
CREATE OR REPLACE FUNCTION ig_publish_log_bump(p_key TEXT) RETURNS void AS $$
  UPDATE ig_publish_log SET attempts = attempts + 1 WHERE key = p_key;
$$ LANGUAGE sql SECURITY DEFINER;
REVOKE ALL ON FUNCTION ig_publish_log_bump(TEXT) FROM PUBLIC;
