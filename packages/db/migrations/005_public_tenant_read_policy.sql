-- Allow customers (authenticated) and anonymous users to read active tenants.
-- This is required for the mobile home screen to display business listings.
-- Without this policy, Supabase RLS blocks all reads on the tenants table
-- for non-tenant users, causing an empty businesses list.

CREATE POLICY "Active tenants are publicly readable"
  ON tenants
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');
