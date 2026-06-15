-- Fix infinite recursion in property_admins RLS.
-- The "Property admins manage admins" policy referenced property_admins inside
-- its own USING clause, which recurses under RLS and throws on every SELECT.
-- This broke property-admin login: the login page's property_admins lookup
-- errored out, returned null, and the user fell through to /dashboard which
-- redirects to /auth/register when no tenant is found.
-- Move the membership check into a SECURITY DEFINER function that bypasses RLS.

CREATE OR REPLACE FUNCTION public.is_admin_of_property(p_property_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.property_admins
    WHERE property_id = p_property_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Property admins manage admins" ON public.property_admins;

CREATE POLICY "Property admins manage admins" ON public.property_admins
  FOR ALL
  USING (public.is_admin_of_property(property_id))
  WITH CHECK (public.is_admin_of_property(property_id));
