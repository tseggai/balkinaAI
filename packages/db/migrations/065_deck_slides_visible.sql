-- Deck CMS: per-slide visibility toggle (hidden slides are skipped when the
-- public deck renders, but stay editable in the admin).
ALTER TABLE deck_slides ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;
