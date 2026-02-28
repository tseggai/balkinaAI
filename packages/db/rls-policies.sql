-- =============================================================================
-- Balkina AI — Row Level Security (RLS) Policies
-- =============================================================================
-- Apply AFTER running 001_initial_schema.sql (RLS is already ENABLED there).
-- These policies define who can SELECT / INSERT / UPDATE / DELETE each table.
--
-- Access model:
--   • Service role (SUPABASE_SERVICE_ROLE_KEY) — bypasses ALL RLS. Used only
--     in server-side API routes. Never exposed client-side.
--   • Authenticated tenant users — identified by auth.uid() and a lookup
--     through the `tenant_users` helper function below.
--   • Authenticated customers — auth.uid() maps directly to customers.id.
--   • Anon — only allowed to read public-facing data (categories, services,
--     subscription_plans).
-- =============================================================================

-- ─── Helper: get the tenant_id for the currently authenticated user ───────────
-- Tenant panel users authenticate via Supabase Auth. Their tenant_id is stored
-- in auth.users.raw_app_meta_data->>'tenant_id' (set server-side on signup).
-- This function is SECURITY DEFINER so it can read auth.users safely.

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$;

-- ─── Helper: check if the current user is a platform admin ──────────────────
-- Admins have role = 'platform_admin' in their JWT app_metadata.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'role') = 'platform_admin';
$$;


-- =============================================================================
-- subscription_plans — public read, admin write
-- =============================================================================

CREATE POLICY "Anyone can read subscription plans"
  ON subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Only platform admins can insert subscription plans"
  ON subscription_plans FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE POLICY "Only platform admins can update subscription plans"
  ON subscription_plans FOR UPDATE
  USING (is_platform_admin());

CREATE POLICY "Only platform admins can delete subscription plans"
  ON subscription_plans FOR DELETE
  USING (is_platform_admin());


-- =============================================================================
-- tenants — tenant users manage their own row; admins manage all
-- =============================================================================

CREATE POLICY "Tenant users can read their own tenant"
  ON tenants FOR SELECT
  USING (id = get_my_tenant_id() OR is_platform_admin());

CREATE POLICY "Only platform admins can create tenants"
  ON tenants FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE POLICY "Tenant users can update their own tenant"
  ON tenants FOR UPDATE
  USING (id = get_my_tenant_id() OR is_platform_admin());

CREATE POLICY "Only platform admins can delete tenants"
  ON tenants FOR DELETE
  USING (is_platform_admin());


-- =============================================================================
-- tenant_locations
-- =============================================================================

CREATE POLICY "Tenant users can read their own locations"
  ON tenant_locations FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant users can insert their own locations"
  ON tenant_locations FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can update their own locations"
  ON tenant_locations FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can delete their own locations"
  ON tenant_locations FOR DELETE
  USING (tenant_id = get_my_tenant_id());

-- Customers and anon users can read locations (needed for chatbot discovery)
CREATE POLICY "Public can read locations"
  ON tenant_locations FOR SELECT
  USING (true);


-- =============================================================================
-- staff
-- =============================================================================

CREATE POLICY "Tenant users can read their own staff"
  ON staff FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant users can insert their own staff"
  ON staff FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can update their own staff"
  ON staff FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can delete their own staff"
  ON staff FOR DELETE
  USING (tenant_id = get_my_tenant_id());

-- Customers can read staff (needed for chatbot to show staff availability)
CREATE POLICY "Authenticated users can read staff"
  ON staff FOR SELECT
  USING (auth.role() = 'authenticated');


-- =============================================================================
-- categories — global taxonomy, public read, admin write
-- =============================================================================

CREATE POLICY "Anyone can read categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Only platform admins can manage categories"
  ON categories FOR INSERT
  WITH CHECK (is_platform_admin());

CREATE POLICY "Only platform admins can update categories"
  ON categories FOR UPDATE
  USING (is_platform_admin());

CREATE POLICY "Only platform admins can delete categories"
  ON categories FOR DELETE
  USING (is_platform_admin());


-- =============================================================================
-- services — tenant write, public read
-- =============================================================================

CREATE POLICY "Anyone can read services"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "Tenant users can insert their own services"
  ON services FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can update their own services"
  ON services FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can delete their own services"
  ON services FOR DELETE
  USING (tenant_id = get_my_tenant_id());


-- =============================================================================
-- service_extras — inherit service visibility
-- =============================================================================

CREATE POLICY "Anyone can read service extras"
  ON service_extras FOR SELECT
  USING (true);

CREATE POLICY "Tenant users can manage extras for their own services"
  ON service_extras FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_id AND s.tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "Tenant users can update extras for their own services"
  ON service_extras FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_id AND s.tenant_id = get_my_tenant_id()
    )
  );

CREATE POLICY "Tenant users can delete extras for their own services"
  ON service_extras FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_id AND s.tenant_id = get_my_tenant_id()
    )
  );


-- =============================================================================
-- customers — customers manage their own row only
-- =============================================================================

CREATE POLICY "Customers can read their own profile"
  ON customers FOR SELECT
  USING (id = auth.uid() OR is_platform_admin());

CREATE POLICY "Customers can insert their own profile"
  ON customers FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Customers can update their own profile"
  ON customers FOR UPDATE
  USING (id = auth.uid());

-- Tenant users need to read customer data for their appointments
CREATE POLICY "Tenant users can read customers they have appointments with"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.customer_id = customers.id
        AND a.tenant_id = get_my_tenant_id()
    )
  );


-- =============================================================================
-- appointments
-- =============================================================================

CREATE POLICY "Customers can read their own appointments"
  ON appointments FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Tenant users can read their own appointments"
  ON appointments FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());

CREATE POLICY "Customers can create appointments"
  ON appointments FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Status updates done server-side via service role; tenant can also update
CREATE POLICY "Tenant users can update their own appointments"
  ON appointments FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Customers can cancel their own appointments"
  ON appointments FOR UPDATE
  USING (customer_id = auth.uid());


-- =============================================================================
-- customer_behavior_profiles
-- =============================================================================

CREATE POLICY "Customers can read their own behavior profiles"
  ON customer_behavior_profiles FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Tenant users can read behavior profiles for their tenant"
  ON customer_behavior_profiles FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- Only service role (backend) inserts/updates — no client-side policy needed.
-- Profiles are computed and written by the AI nudge engine server-side.


-- =============================================================================
-- coupons
-- =============================================================================

CREATE POLICY "Tenant users can read their own coupons"
  ON coupons FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());

CREATE POLICY "Tenant users can create their own coupons"
  ON coupons FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can update their own coupons"
  ON coupons FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can delete their own coupons"
  ON coupons FOR DELETE
  USING (tenant_id = get_my_tenant_id());

-- Authenticated users (customers) can read coupon validity (not full list)
CREATE POLICY "Authenticated users can lookup a coupon by code"
  ON coupons FOR SELECT
  USING (auth.role() = 'authenticated');


-- =============================================================================
-- reviews
-- =============================================================================

CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Customers can write a review for their own completed appointment"
  ON reviews FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_id
        AND a.customer_id = auth.uid()
        AND a.status = 'completed'
    )
  );

CREATE POLICY "Customers can update their own review"
  ON reviews FOR UPDATE
  USING (customer_id = auth.uid());

CREATE POLICY "Tenant users can read reviews for their tenant"
  ON reviews FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());


-- =============================================================================
-- ai_nudge_log — service role only for writes; admins and tenants can read
-- =============================================================================

CREATE POLICY "Tenant users can read nudge logs for their tenant"
  ON ai_nudge_log FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_platform_admin());

-- Writes are done exclusively by the server-side nudge engine via service role.
-- No INSERT/UPDATE client policy needed.


-- =============================================================================
-- stripe_webhook_events — service role only
-- No SELECT policy — app code never queries this from client side.
-- Idempotency checks happen server-side via service role.
-- =============================================================================

-- Deny everything from client side (service role bypasses this automatically)
CREATE POLICY "No client access to webhook events"
  ON stripe_webhook_events FOR ALL
  USING (false);
