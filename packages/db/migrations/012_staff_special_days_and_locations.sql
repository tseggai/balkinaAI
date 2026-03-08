-- Migration 012: Add staff_special_days and staff_locations junction tables
-- Staff special days: custom hours or day-off for specific dates
-- Staff locations: which locations a staff member works at

-- ── Staff special days ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_special_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  end_time time,
  is_day_off boolean DEFAULT false,
  breaks jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_special_days_staff ON staff_special_days(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_special_days_date ON staff_special_days(date);

ALTER TABLE staff_special_days ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Tenant can manage staff_special_days'
  ) THEN
    CREATE POLICY "Tenant can manage staff_special_days"
      ON staff_special_days FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM staff s
          JOIN tenants t ON t.id = s.tenant_id
          WHERE s.id = staff_special_days.staff_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── Staff locations junction table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  location_id uuid REFERENCES tenant_locations(id) ON DELETE CASCADE,
  UNIQUE(staff_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_locations_staff ON staff_locations(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_locations_location ON staff_locations(location_id);

ALTER TABLE staff_locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Tenant can manage staff_locations'
  ) THEN
    CREATE POLICY "Tenant can manage staff_locations"
      ON staff_locations FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM staff s
          JOIN tenants t ON t.id = s.tenant_id
          WHERE s.id = staff_locations.staff_id
            AND t.user_id = auth.uid()
        )
      );
  END IF;
END $$;
