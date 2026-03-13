-- Ensure appointments status check constraint matches allowed statuses
-- (in_progress removed — simplified flow: confirmed → completed directly)

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show'));
