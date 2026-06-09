-- Phase 1 restaurant bookings.
-- Tags appointments with a booking type and party size so restaurant table
-- reservations, ticketed events, and private dining ride on the existing
-- appointments + approval + deposit flow — no separate table-inventory engine.
--   service        — default (salon/clinic/etc. appointment, unchanged behaviour)
--   table          — everyday table reservation (typically request-then-confirm)
--   event          — ticketed event / special dinner (capacity-based service)
--   private_dining — private dining / group booking request
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS party_size INTEGER;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_booking_type_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_booking_type_check
  CHECK (booking_type IN ('service', 'table', 'event', 'private_dining'));

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_party_size_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_party_size_check
  CHECK (party_size IS NULL OR party_size > 0);

CREATE INDEX IF NOT EXISTS idx_appointments_booking_type ON appointments(booking_type);
