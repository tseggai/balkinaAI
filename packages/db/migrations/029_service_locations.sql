-- Migration 029: Create service_locations junction table
-- Links services to specific tenant locations (many-to-many).
-- A service with NO rows here is available at ALL tenant locations.

CREATE TABLE IF NOT EXISTS service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES tenant_locations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(service_id, location_id)
);

-- Index for fast lookups by service and by location
CREATE INDEX IF NOT EXISTS idx_service_locations_service ON service_locations(service_id);
CREATE INDEX IF NOT EXISTS idx_service_locations_location ON service_locations(location_id);

-- RLS: tenants can manage their own service-location mappings
ALTER TABLE service_locations ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users (needed for chat find_businesses)
CREATE POLICY "Anyone can read service_locations"
  ON service_locations FOR SELECT
  USING (true);

-- Allow tenants to manage their own service_locations via service ownership
CREATE POLICY "Tenants can manage own service_locations"
  ON service_locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM services s
      JOIN tenants t ON t.id = s.tenant_id
      WHERE s.id = service_locations.service_id
        AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services s
      JOIN tenants t ON t.id = s.tenant_id
      WHERE s.id = service_locations.service_id
        AND t.owner_id = auth.uid()
    )
  );

-- Service role bypass for API operations
CREATE POLICY "Service role full access on service_locations"
  ON service_locations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
