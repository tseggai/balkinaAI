-- Fix infinite recursion between appointments and customers RLS policies.
--
-- The recursion chain was:
--   appointments RLS: "customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())"
--   → triggers customers SELECT
--   → customers RLS: "EXISTS (SELECT 1 FROM appointments WHERE ...)"
--   → triggers appointments SELECT → infinite loop
--
-- Fix: wrap the appointments lookup in a SECURITY DEFINER function so it
-- bypasses RLS on the appointments table and breaks the cycle.

-- 1. Create a helper function that checks appointment existence WITHOUT RLS
CREATE OR REPLACE FUNCTION public.customer_has_appointment_with_tenant(cust_id uuid, t_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.customer_id = cust_id
      AND a.tenant_id = t_id
  );
$$;

-- 2. Replace the recursive policy with one using the SECURITY DEFINER function
DROP POLICY IF EXISTS "Tenant users can read customers they have appointments with" ON customers;
CREATE POLICY "Tenant users can read customers they have appointments with"
  ON customers FOR SELECT
  USING (
    customer_has_appointment_with_tenant(id, get_my_tenant_id())
  );
