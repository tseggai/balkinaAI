-- Phase 2: target property campaigns/announcements at member segments.
-- 'all' (default, every app user as before) | 'residents' (homeowners, renters,
-- commercial owners) | a single member_type for finer targeting.
ALTER TABLE property_campaigns
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all'
  CHECK (audience IN ('all', 'residents', 'homeowner', 'renter', 'commercial_owner'));
