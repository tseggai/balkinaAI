-- ============================================================================
-- 013: Add missing columns for customers, coupons, loyalty_programs
-- ============================================================================

-- ── Customers: add profile fields ───────────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_image_url text;

-- ── Coupons: add image_url ──────────────────────────────────────────────────
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS image_url text;

-- ── Loyalty programs: add name and image_url ────────────────────────────────
ALTER TABLE loyalty_programs ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE loyalty_programs ADD COLUMN IF NOT EXISTS image_url text;
