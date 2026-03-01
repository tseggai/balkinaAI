-- =============================================================================
-- Fix tenant RLS policies and get_my_tenant_id() helper
-- =============================================================================
-- Problem: get_my_tenant_id() read auth.jwt() ->> 'tenant_id' (top-level),
-- but Supabase nests app_metadata under auth.jwt() -> 'app_metadata'.
-- Additionally, the tenants SELECT/UPDATE policies had no user_id = auth.uid()
-- fallback, so newly registered users (whose JWT didn't yet carry tenant_id)
-- could never read their own tenant row — causing an infinite redirect loop.
-- =============================================================================

-- Fix get_my_tenant_id() to:
-- 1. Read from the correct JWT path (app_metadata.tenant_id)
-- 2. Fall back to a direct user_id lookup for fresh registrations
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    (SELECT id FROM tenants WHERE user_id = auth.uid() LIMIT 1)
  );
$$;

-- Recreate SELECT policy with user_id = auth.uid() fallback
DROP POLICY IF EXISTS "Tenant users can read their own tenant" ON tenants;
CREATE POLICY "Tenant users can read their own tenant"
  ON tenants FOR SELECT
  USING (user_id = auth.uid() OR id = get_my_tenant_id() OR is_platform_admin());

-- Recreate UPDATE policy with user_id = auth.uid() fallback
DROP POLICY IF EXISTS "Tenant users can update their own tenant" ON tenants;
CREATE POLICY "Tenant users can update their own tenant"
  ON tenants FOR UPDATE
  USING (user_id = auth.uid() OR id = get_my_tenant_id() OR is_platform_admin());
