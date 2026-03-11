-- Migration 006: Robust service management
-- Adds advanced service fields, service-staff junction, and service special days

-- ── Extended service columns ──────────────────────────────────────────────────

ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';
ALTER TABLE services ADD COLUMN IF NOT EXISTS buffer_time_before integer DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS buffer_time_after integer DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS custom_duration boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS hide_price boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS hide_duration boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public';
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_booking_lead_time integer DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS max_booking_days_ahead integer DEFAULT 60;
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_extras integer DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS max_extras integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_limit_per_customer integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_limit_per_customer_interval text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_limit_per_slot integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_limit_per_slot_interval text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_name text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS timesheet jsonb;

-- ── Extended staff columns ────────────────────────────────────────────────────

ALTER TABLE staff ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- ── Service-staff junction table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  UNIQUE(service_id, staff_id)
);

ALTER TABLE service_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage service_staff"
  ON service_staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM services s
      JOIN tenants t ON t.id = s.tenant_id
      WHERE s.id = service_staff.service_id
        AND t.user_id = auth.uid()
    )
  );

-- ── Service special days table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_special_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  is_day_off boolean DEFAULT false,
  breaks jsonb DEFAULT '[]'
);

ALTER TABLE service_special_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage service_special_days"
  ON service_special_days FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM services s
      JOIN tenants t ON t.id = s.tenant_id
      WHERE s.id = service_special_days.service_id
        AND t.user_id = auth.uid()
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_service_staff_service ON service_staff(service_id);
CREATE INDEX IF NOT EXISTS idx_service_staff_staff ON service_staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_service_special_days_service ON service_special_days(service_id);
CREATE INDEX IF NOT EXISTS idx_service_special_days_date ON service_special_days(date);
CREATE INDEX IF NOT EXISTS idx_services_visibility ON services(visibility);
