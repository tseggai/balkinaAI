-- Restaurant Booking Phase 1 — service_type discriminator.
-- Drives the service form (which fields show), the booking flow, pricing, and
-- approval. The appointment's booking_type (Migration 047) is derived from this.
--   standard — normal appointment service (salon/clinic/etc.), unchanged
--   event    — ticketed event / set menu: capacity-gated, instant-confirm, prepaid
--   table    — request-only table reservation: open-hours, staff-approved
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_service_type_check;
ALTER TABLE services
  ADD CONSTRAINT services_service_type_check
  CHECK (service_type IN ('standard', 'event', 'table'));

CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type);
