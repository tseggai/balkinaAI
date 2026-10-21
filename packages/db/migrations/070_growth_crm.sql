-- Growth CRM (steps 1–2 of the sales follow-up plan).
-- Prospect rows carry engagement + follow-up state that is derived from
-- growth_events by a trigger, so the admin list can sort/filter on it without
-- scanning events, and so both the claim page (marketing) and the admin panel
-- feed the same timeline.

-- ─── Pipeline: two engagement stages between contacted and replied ───────────
ALTER TABLE growth_prospects DROP CONSTRAINT IF EXISTS growth_prospects_stage_check;
ALTER TABLE growth_prospects ADD CONSTRAINT growth_prospects_stage_check CHECK (stage IN (
  'new', 'enriched', 'qualified', 'disqualified', 'preprovisioned',
  'contacted', 'viewed', 'engaged', 'replied', 'claimed', 'signed_up', 'customer', 'lost'
));

-- ─── Engagement + follow-up columns ──────────────────────────────────────────
ALTER TABLE growth_prospects
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_type TEXT,
  ADD COLUMN IF NOT EXISTS touches INTEGER NOT NULL DEFAULT 0,        -- outbound messages we sent
  ADD COLUMN IF NOT EXISTS page_views INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_viewed_at TIMESTAMPTZ,                -- first claim-page view
  ADD COLUMN IF NOT EXISTS page_seconds INTEGER NOT NULL DEFAULT 0,   -- summed visible time on the claim page
  ADD COLUMN IF NOT EXISTS demo_completed_at TIMESTAMPTZ;             -- first completed test booking

CREATE INDEX IF NOT EXISTS idx_growth_events_prospect_time ON growth_events (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_follow_up ON growth_prospects (next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_prospects_activity ON growth_prospects (last_activity_at DESC NULLS LAST);

-- ─── Trigger: every event updates the prospect's engagement + stage ───────────
-- Stage only ever moves forward from an automated signal; admins can still set
-- any stage by hand.
CREATE OR REPLACE FUNCTION growth_events_apply() RETURNS TRIGGER AS $$
DECLARE
  secs INTEGER := 0;
BEGIN
  IF NEW.prospect_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.type = 'claim_page_leave' THEN
    secs := LEAST(GREATEST(COALESCE((NEW.payload->>'seconds')::numeric, 0)::integer, 0), 3600);
  END IF;

  UPDATE growth_prospects SET
    last_activity_at = CASE WHEN NEW.type IN ('claim_page_leave', 'note') THEN last_activity_at ELSE GREATEST(COALESCE(last_activity_at, NEW.created_at), NEW.created_at) END,
    last_activity_type = CASE WHEN NEW.type IN ('claim_page_leave', 'note') THEN last_activity_type ELSE NEW.type END,
    page_views = page_views + CASE WHEN NEW.type = 'claim_page_view' THEN 1 ELSE 0 END,
    page_viewed_at = CASE WHEN NEW.type = 'claim_page_view' THEN COALESCE(page_viewed_at, NEW.created_at) ELSE page_viewed_at END,
    page_seconds = page_seconds + secs,
    demo_completed_at = CASE WHEN NEW.type = 'claim_demo_completed' THEN COALESCE(demo_completed_at, NEW.created_at) ELSE demo_completed_at END,
    last_contacted_at = CASE WHEN NEW.type = 'sent' THEN NEW.created_at ELSE last_contacted_at END,
    touches = touches + CASE WHEN NEW.type = 'sent' THEN 1 ELSE 0 END,
    stage = CASE
      WHEN NEW.type = 'claimed' THEN 'claimed'
      WHEN NEW.type = 'replied' AND stage IN ('preprovisioned', 'contacted', 'viewed', 'engaged') THEN 'replied'
      WHEN NEW.type IN ('claim_demo_completed', 'claim_activate_opened', 'claim_clicked') AND stage IN ('preprovisioned', 'contacted', 'viewed') THEN 'engaged'
      WHEN NEW.type = 'claim_page_view' AND stage IN ('preprovisioned', 'contacted') THEN 'viewed'
      WHEN NEW.type = 'sent' AND stage IN ('new', 'enriched', 'qualified', 'preprovisioned') THEN 'contacted'
      ELSE stage
    END,
    updated_at = now()
  WHERE id = NEW.prospect_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_growth_events_apply ON growth_events;
CREATE TRIGGER trg_growth_events_apply AFTER INSERT ON growth_events
  FOR EACH ROW EXECUTE FUNCTION growth_events_apply();

-- ─── Backfill from events already recorded ───────────────────────────────────
UPDATE growth_prospects p SET
  page_views = s.page_views,
  page_viewed_at = s.page_viewed_at,
  demo_completed_at = s.demo_completed_at,
  last_activity_at = s.last_activity_at,
  last_activity_type = s.last_activity_type
FROM (
  SELECT
    e.prospect_id,
    COUNT(*) FILTER (WHERE e.type = 'claim_page_view') AS page_views,
    MIN(e.created_at) FILTER (WHERE e.type = 'claim_page_view') AS page_viewed_at,
    MIN(e.created_at) FILTER (WHERE e.type = 'claim_demo_completed') AS demo_completed_at,
    MAX(e.created_at) FILTER (WHERE e.type NOT IN ('claim_page_leave', 'note')) AS last_activity_at,
    (ARRAY_AGG(e.type ORDER BY e.created_at DESC) FILTER (WHERE e.type NOT IN ('claim_page_leave', 'note')))[1] AS last_activity_type
  FROM growth_events e
  WHERE e.prospect_id IS NOT NULL
  GROUP BY e.prospect_id
) s
WHERE s.prospect_id = p.id;

UPDATE growth_prospects SET stage = 'engaged'
WHERE stage IN ('preprovisioned', 'contacted', 'viewed') AND demo_completed_at IS NOT NULL;
UPDATE growth_prospects SET stage = 'viewed'
WHERE stage IN ('preprovisioned', 'contacted') AND page_viewed_at IS NOT NULL;
