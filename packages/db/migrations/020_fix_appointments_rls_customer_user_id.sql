-- Fix: Allow customers to see appointments where their auth user is linked
-- via the customers.user_id column (not just customer_id = auth.uid()).
-- This handles bookings created via chat widget where a separate customer
-- record was created before the user signed up.

-- DROP and recreate the SELECT policy for customers
DROP POLICY IF EXISTS "Customers can read their own appointments" ON appointments;
CREATE POLICY "Customers can read their own appointments"
  ON appointments FOR SELECT
  USING (
    customer_id = auth.uid()
    OR customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );

-- Also fix the UPDATE policy so customers can cancel linked bookings
DROP POLICY IF EXISTS "Customers can cancel their own appointments" ON appointments;
CREATE POLICY "Customers can cancel their own appointments"
  ON appointments FOR UPDATE
  USING (
    customer_id = auth.uid()
    OR customer_id IN (
      SELECT id FROM customers WHERE user_id = auth.uid()
    )
  );
