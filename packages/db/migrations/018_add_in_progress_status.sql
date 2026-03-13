-- Add 'in_progress' to the appointments status check constraint
-- This is needed for the staff app "Start" action (confirmed → in_progress)

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'in_progress'));
