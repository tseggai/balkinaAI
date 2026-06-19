-- Attendee check-in for campaign entries (iPad checklist + QR scan).
ALTER TABLE campaign_entries ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
