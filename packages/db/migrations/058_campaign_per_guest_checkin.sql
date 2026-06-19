-- Per-guest check-in: a map of guest index -> ISO check-in timestamp.
-- Guests are derived from campaign_entries.data.guests ([{name}], index 0 = the
-- RSVPer, 1..N = plus-ones). Each guest has its own QR (entryId.index).
ALTER TABLE campaign_entries ADD COLUMN IF NOT EXISTS checked_in jsonb NOT NULL DEFAULT '{}'::jsonb;
