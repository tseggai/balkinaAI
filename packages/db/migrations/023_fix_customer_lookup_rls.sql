-- Fix: Allow authenticated users to look up a customer record by their own
-- email or phone for account linking purposes.
--
-- Problem: When a customer is created via chat widget (id = auto-generated,
-- user_id = NULL), and the same person later signs in on mobile with a
-- different auth user, the mobile app cannot find the customer record by
-- email/phone because RLS only allows id = auth.uid() OR user_id = auth.uid().
-- The mobile app's account linking logic (update user_id) also fails silently.
--
-- Solution: Add a SELECT policy that allows authenticated users to find
-- customer records matching their own auth email or phone.

CREATE POLICY "Authenticated users can find customer by own email"
  ON customers FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
  );

-- Also allow the linking UPDATE (set user_id) when the customer was found
-- by email/phone match but user_id is not yet set.
CREATE POLICY "Authenticated users can link their account to matching customer"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    user_id IS NULL
    AND (
      email = (SELECT email FROM auth.users WHERE id = auth.uid())
      OR phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
  );
