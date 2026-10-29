-- Migration 077: the Instagram access token lives in the DB so the admin can replace, refresh and
-- disconnect it without a Vercel redeploy. The env var META_IG_ACCESS_TOKEN stays as a fallback.

ALTER TABLE ig_settings
  ADD COLUMN IF NOT EXISTS access_token     TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ig_username      TEXT,
  ADD COLUMN IF NOT EXISTS ig_user_id       TEXT;
