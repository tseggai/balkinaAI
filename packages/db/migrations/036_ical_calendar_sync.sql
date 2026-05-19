-- Phase 1: iCal Calendar Sync
-- Export: each staff member gets a unique feed URL
-- Import: tenants paste external iCal URLs, we poll and block those slots

-- Add export token to staff
ALTER TABLE staff ADD COLUMN IF NOT EXISTS ical_feed_token UUID DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_ical_feed_token ON staff(ical_feed_token) WHERE ical_feed_token IS NOT NULL;

-- Backfill existing staff with tokens
UPDATE staff SET ical_feed_token = gen_random_uuid() WHERE ical_feed_token IS NULL;

-- External calendar subscriptions
CREATE TABLE IF NOT EXISTS staff_external_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'External Calendar',
  ical_url TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE staff_external_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants manage own staff calendars"
  ON staff_external_calendars
  FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));

-- Cached events from external calendars
CREATE TABLE IF NOT EXISTS external_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_calendar_id UUID NOT NULL REFERENCES staff_external_calendars(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  uid TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  summary TEXT,
  UNIQUE (external_calendar_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_ext_cal_events_staff_time
  ON external_calendar_events(staff_id, start_time, end_time);

ALTER TABLE external_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants read own staff external events"
  ON external_calendar_events
  FOR SELECT
  USING (staff_id IN (SELECT id FROM staff WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())));
