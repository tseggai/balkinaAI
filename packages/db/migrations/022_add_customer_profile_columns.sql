-- Add profile columns to customers table that the tenant portal form expects
ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
