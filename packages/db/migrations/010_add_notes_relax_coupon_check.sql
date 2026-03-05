-- ============================================================================
-- 010: Add notes column to appointments, relax coupon discount_value check
-- ============================================================================

-- ── Appointments: add notes column ──────────────────────────────────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes text;

-- ── Coupons: relax discount_value check to allow >= 0 ──────────────────────
-- Drop the old check constraint that requires discount_value > 0
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_discount_value_check;
-- Re-add with >= 0 to allow saving coupons while filling in the form
ALTER TABLE coupons ADD CONSTRAINT coupons_discount_value_check CHECK (discount_value >= 0);
