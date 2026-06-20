-- Full-screen loading/splash image for a property's white-label app.
-- Shown full-bleed on the in-app boot loader while the storefront loads.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS splash_image_url TEXT;
