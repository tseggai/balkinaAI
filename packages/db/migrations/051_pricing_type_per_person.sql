-- Restaurant Booking Phase 1 — allow 'per_person' pricing for events.
-- Events (service_type='event') price per guest: total = price × party_size.
-- The existing services_pricing_type_check only permitted per_service/per_day/
-- per_week, so saving an event failed with a check-constraint violation.
ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_pricing_type_check;
ALTER TABLE services
  ADD CONSTRAINT services_pricing_type_check
  CHECK (pricing_type IN ('per_service', 'per_day', 'per_week', 'per_person'));
