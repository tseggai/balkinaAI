-- 050: Rename the two business buckets to service / hospitality and add the
-- hospitality category taxonomy.
--
-- Migration 049 introduced tenants.business_type as 'standard' | 'restaurant'.
-- We broaden the vocabulary so the second bucket covers all hospitality
-- (restaurants, cafés/bars, event venues, hotels) — not just restaurants.
--   standard   -> service
--   restaurant -> hospitality

-- 1) tenants.business_type: re-map values, default, and check constraint.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_business_type_check;

UPDATE tenants SET business_type = 'service'     WHERE business_type IS NULL OR business_type = 'standard';
UPDATE tenants SET business_type = 'hospitality' WHERE business_type = 'restaurant';

ALTER TABLE tenants ALTER COLUMN business_type SET DEFAULT 'service';
ALTER TABLE tenants
  ADD CONSTRAINT tenants_business_type_check
  CHECK (business_type IN ('service', 'hospitality'));

-- 2) categories.business_type — split the taxonomy so registration can show only
-- the categories relevant to the chosen business bucket. Existing categories are
-- all service-style; hospitality categories are seeded below.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'service';

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_business_type_check;
ALTER TABLE categories
  ADD CONSTRAINT categories_business_type_check
  CHECK (business_type IN ('service', 'hospitality'));

-- 3) Hospitality taxonomy: a top-level "Hospitality" group + its children.
-- Idempotent — guarded by slug so re-running is a no-op.
INSERT INTO categories (parent_id, name, slug, display_order, business_type)
SELECT NULL, 'Hospitality', 'hospitality', 100, 'hospitality'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'hospitality');

INSERT INTO categories (parent_id, name, slug, display_order, business_type)
SELECT p.id, v.name, v.slug, v.display_order, 'hospitality'
FROM (SELECT id FROM categories WHERE slug = 'hospitality') p
CROSS JOIN (VALUES
  ('Restaurant',                     'restaurant',                   1),
  ('Café / Bar',                     'cafe-bar',                     2),
  ('Events Venue / Private Dining',  'events-venue-private-dining',  3),
  ('Hotel / Resort',                 'hotel-resort',                 4)
) AS v(name, slug, display_order)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = v.slug);
