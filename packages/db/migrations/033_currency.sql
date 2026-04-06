-- Add currency preference to waitlist and tenants

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

COMMENT ON COLUMN tenants.currency IS 'ISO 4217 currency code (EUR, USD, GBP, etc.)';
COMMENT ON COLUMN waitlist.currency IS 'Preferred currency from signup form';
