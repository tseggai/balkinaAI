-- Add 'approved' to valid appointment statuses
-- Flow: pending → approved (deposit due) → confirmed (deposit paid)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointment_status_check;

ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'approved', 'confirmed', 'cancelled', 'completed', 'no_show'));
