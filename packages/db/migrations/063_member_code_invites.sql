-- Per-person member invites reuse property_member_codes: a code bound to a
-- single email/phone with max_redemptions = 1, delivered via email/SMS. A code
-- with no email/phone is a shared/broadcast code (existing behaviour).
ALTER TABLE property_member_codes ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE property_member_codes ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE property_member_codes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
