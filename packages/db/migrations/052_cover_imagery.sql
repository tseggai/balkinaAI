-- Migration 052: Cover imagery for the photo-led property storefront
-- Adds full-bleed cover/hero images for white-label property apps:
--   properties.cover_image_url — storefront hero background
--   tenants.cover_image_url    — photo used on storefront business cards
-- Both are optional; the storefront falls back to logo/monogram when null.

ALTER TABLE properties ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN properties.cover_image_url IS 'Full-bleed hero/cover image for the white-label property storefront';
COMMENT ON COLUMN tenants.cover_image_url IS 'Cover/hero photo used on storefront business cards';
