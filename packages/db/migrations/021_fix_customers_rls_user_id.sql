-- Fix: Allow customers to read/update their own profile when their customer
-- record was created via chat (customer.id != auth.uid(), but customer.user_id = auth.uid())

DROP POLICY IF EXISTS "Customers can read their own profile" ON customers;
CREATE POLICY "Customers can read their own profile"
  ON customers FOR SELECT
  USING (
    id = auth.uid()
    OR user_id = auth.uid()
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Customers can update their own profile" ON customers;
CREATE POLICY "Customers can update their own profile"
  ON customers FOR UPDATE
  USING (
    id = auth.uid()
    OR user_id = auth.uid()
  );
