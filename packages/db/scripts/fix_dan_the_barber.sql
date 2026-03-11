-- Fix Dan the Barber seed data
-- 1. Update location to Milpitas address
-- 2. Remove pet grooming services (those belong to Happy Paws)

-- Step 1: Update Dan the Barber's location to Milpitas
UPDATE tenant_locations
SET
  address = '150 S Main St, Milpitas, CA 95035',
  lat = 37.4323,
  lng = -121.8996
WHERE tenant_id = (
  SELECT id FROM tenants WHERE name = 'Dan the Barber' LIMIT 1
);

-- Step 2: Delete pet grooming services from Dan the Barber
-- First delete any service_extras for those services
DELETE FROM service_extras
WHERE service_id IN (
  SELECT s.id FROM services s
  JOIN tenants t ON s.tenant_id = t.id
  WHERE t.name = 'Dan the Barber'
    AND s.name IN ('Bath & Brush Only', 'Cat Grooming', 'Large Dog Full Groom', 'Nail Trim Only', 'Small Dog Full Groom')
);

-- Delete any service_staff entries for those services
DELETE FROM service_staff
WHERE service_id IN (
  SELECT s.id FROM services s
  JOIN tenants t ON s.tenant_id = t.id
  WHERE t.name = 'Dan the Barber'
    AND s.name IN ('Bath & Brush Only', 'Cat Grooming', 'Large Dog Full Groom', 'Nail Trim Only', 'Small Dog Full Groom')
);

-- Delete any service_special_days for those services
DELETE FROM service_special_days
WHERE service_id IN (
  SELECT s.id FROM services s
  JOIN tenants t ON s.tenant_id = t.id
  WHERE t.name = 'Dan the Barber'
    AND s.name IN ('Bath & Brush Only', 'Cat Grooming', 'Large Dog Full Groom', 'Nail Trim Only', 'Small Dog Full Groom')
);

-- Delete any appointment_extras referencing extras from those services
DELETE FROM appointment_extras
WHERE extra_id IN (
  SELECT se.id FROM service_extras se
  JOIN services s ON se.service_id = s.id
  JOIN tenants t ON s.tenant_id = t.id
  WHERE t.name = 'Dan the Barber'
    AND s.name IN ('Bath & Brush Only', 'Cat Grooming', 'Large Dog Full Groom', 'Nail Trim Only', 'Small Dog Full Groom')
);

-- Now delete the pet grooming services themselves
DELETE FROM services
WHERE tenant_id = (
  SELECT id FROM tenants WHERE name = 'Dan the Barber' LIMIT 1
)
AND name IN ('Bath & Brush Only', 'Cat Grooming', 'Large Dog Full Groom', 'Nail Trim Only', 'Small Dog Full Groom');
