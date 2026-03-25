-- =============================================================================
-- 028: RLS policies for customer_behavior_profiles and ai_nudge_log
-- =============================================================================
-- These tables are primarily accessed server-side via service role (which
-- bypasses RLS). These policies grant tenant users read access to their own
-- data and ensure service role has unrestricted access.
-- =============================================================================

-- ─── Enable RLS (idempotent) ─────────────────────────────────────────────────
ALTER TABLE customer_behavior_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_nudge_log ENABLE ROW LEVEL SECURITY;

-- ─── customer_behavior_profiles ──────────────────────────────────────────────

-- Tenants can read behavior profiles belonging to their tenant
CREATE POLICY "Tenants can view their own behavior profiles"
  ON customer_behavior_profiles
  FOR SELECT
  USING (tenant_id = public.get_my_tenant_id());

-- Service role bypasses RLS automatically, but add an explicit permissive
-- policy so that non-service-role server contexts (e.g. edge functions with
-- a user JWT that has service_role claim) also work.
CREATE POLICY "Service role full access to behavior profiles"
  ON customer_behavior_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── ai_nudge_log ────────────────────────────────────────────────────────────

-- Tenants can read nudge logs belonging to their tenant
CREATE POLICY "Tenants can view their own nudge logs"
  ON ai_nudge_log
  FOR SELECT
  USING (tenant_id = public.get_my_tenant_id());

-- Service role can read and insert nudge logs
CREATE POLICY "Service role full access to nudge logs"
  ON ai_nudge_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
