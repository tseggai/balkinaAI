-- Add structured address fields to tenant_locations
-- Enables reliable filtering by city, country, state instead of parsing free-text address

ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS street_address TEXT;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS country TEXT;

-- Indexes for common filter columns
CREATE INDEX IF NOT EXISTS idx_tenant_locations_city ON tenant_locations (city);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_country ON tenant_locations (country);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_state ON tenant_locations (state);

-- Best-effort backfill from existing address field
-- For "123 Main St, San Francisco, CA, USA" -> city = second-to-last segment, country = last
UPDATE tenant_locations
SET city = TRIM(parts[array_length(parts, 1) - 1]),
    country = TRIM(parts[array_length(parts, 1)])
FROM (
  SELECT id AS loc_id, string_to_array(address, ',') AS parts
  FROM tenant_locations
  WHERE city IS NULL AND address IS NOT NULL AND address LIKE '%,%'
) AS parsed
WHERE tenant_locations.id = parsed.loc_id
AND array_length(parsed.parts, 1) >= 2;
