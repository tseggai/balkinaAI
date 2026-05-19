-- Phase 2: Google Calendar OAuth integration
-- Staff connect Google Calendar for real-time bidirectional sync

-- Google Calendar connections per staff
CREATE TABLE IF NOT EXISTS staff_google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id)
);

ALTER TABLE staff_google_calendar_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenants manage own staff google connections"
    ON staff_google_calendar_connections FOR ALL
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()))
    WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Track Google Calendar event IDs on appointments for push/update/delete
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
