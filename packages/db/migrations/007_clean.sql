-- =============================================================================
-- Migration 007 (Clean): Phase 6 — Full Feature Parity
-- Custom fields, packages, loyalty, inventory, roles, enhanced services/staff/locations
--
-- Safe to run in one shot in Supabase SQL Editor.
-- All policies use DO/EXCEPTION blocks because PostgreSQL does NOT support
-- CREATE POLICY IF NOT EXISTS.
-- =============================================================================

-- =============================================
-- SECTION 1: CREATE TABLES (dependency order)
-- =============================================

-- ── Custom fields for appointments ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb,
  is_required boolean DEFAULT false,
  applies_to text DEFAULT 'appointment',
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  custom_field_id uuid REFERENCES custom_fields(id) ON DELETE CASCADE,
  value text,
  created_at timestamptz DEFAULT now()
);

-- ── Staff holidays ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- ── Packages ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  image_url text,
  name text NOT NULL,
  has_expiration boolean DEFAULT false,
  expiration_value integer,
  expiration_unit text,
  is_private boolean DEFAULT false,
  description text,
  price numeric(10,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS package_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES packages(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1,
  UNIQUE(package_id, service_id)
);

CREATE TABLE IF NOT EXISTS customer_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  package_id uuid REFERENCES packages(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  sessions_remaining jsonb DEFAULT '{}',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- ── Loyalty program ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  is_active boolean DEFAULT true,
  points_per_booking integer DEFAULT 0,
  points_per_currency_unit numeric(10,2) DEFAULT 0,
  points_to_currency_rate numeric(10,4) DEFAULT 0.01,
  min_redemption_points integer DEFAULT 100,
  points_expiry_days integer,
  tiers jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_program_id uuid REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  condition_value numeric(10,2),
  points_value numeric(10,2),
  service_id uuid REFERENCES services(id),
  staff_id uuid REFERENCES staff(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  points_balance integer DEFAULT 0,
  tier text DEFAULT 'bronze',
  lifetime_points integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id),
  transaction_type text NOT NULL,
  points integer NOT NULL,
  description text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ── Product inventory ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  image_url text,
  name text NOT NULL,
  quantity_on_hand integer DEFAULT 0,
  min_order_quantity integer DEFAULT 1,
  max_order_quantity integer,
  purchase_price numeric(10,2) DEFAULT 0,
  sell_price numeric(10,2) DEFAULT 0,
  display_in_booking boolean DEFAULT false,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  quantity_used integer DEFAULT 1,
  UNIQUE(product_id, service_id)
);

-- ── User roles and permissions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES staff_roles(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  UNIQUE(role_id, staff_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES staff_roles(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_add boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  UNIQUE(role_id, module)
);


-- =============================================
-- SECTION 2: ALTER TABLE — ADD COLUMNS
-- =============================================

-- ── Service enhancements (columns NOT already in 001 or 006) ────────────────
-- Note: deposit_enabled, deposit_type, deposit_amount exist from 001.
-- ADD COLUMN IF NOT EXISTS is safe — no-ops if column already present.

ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_enabled boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_type text DEFAULT 'fixed';
ALTER TABLE services ADD COLUMN IF NOT EXISTS recurring_type text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS recurring_frequency integer DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS capacity_type text DEFAULT 'alone';
ALTER TABLE services ADD COLUMN IF NOT EXISTS max_capacity integer DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS bring_friend boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_category text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_subcategory text;

-- ── Service-staff pricing columns ───────────────────────────────────────────

ALTER TABLE service_staff ADD COLUMN IF NOT EXISTS custom_price numeric(10,2);
ALTER TABLE service_staff ADD COLUMN IF NOT EXISTS custom_deposit numeric(10,2);
ALTER TABLE service_staff ADD COLUMN IF NOT EXISTS deposit_type text DEFAULT 'fixed';

-- ── Staff enhancements ──────────────────────────────────────────────────────

ALTER TABLE staff ADD COLUMN IF NOT EXISTS profession text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS booking_limit_capacity integer;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS booking_limit_interval text;

-- ── Location booking limiter ────────────────────────────────────────────────

ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS booking_limit_enabled boolean DEFAULT false;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS booking_limit_capacity integer;
ALTER TABLE tenant_locations ADD COLUMN IF NOT EXISTS booking_limit_interval text;


-- =============================================
-- SECTION 3: INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_custom_fields_tenant ON custom_fields(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_cfv_appt ON appointment_custom_field_values(appointment_id);
CREATE INDEX IF NOT EXISTS idx_staff_holidays_staff ON staff_holidays(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_holidays_date ON staff_holidays(date);
CREATE INDEX IF NOT EXISTS idx_packages_tenant ON packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_package_services_pkg ON package_services(package_id);
CREATE INDEX IF NOT EXISTS idx_customer_packages_customer ON customer_packages(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_packages_tenant ON customer_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant ON loyalty_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_rules_program ON loyalty_rules(loyalty_program_id);
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_tenant ON customer_loyalty_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_tenant ON loyalty_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_services_product ON product_services(product_id);
CREATE INDEX IF NOT EXISTS idx_staff_roles_tenant ON staff_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_role_assignments_role ON staff_role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);


-- =============================================
-- SECTION 4: ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;


-- =============================================
-- SECTION 5: RLS POLICIES
-- PostgreSQL does NOT support CREATE POLICY IF NOT EXISTS.
-- We use DO/EXCEPTION blocks to safely handle duplicates.
-- =============================================

-- ── Tenant-scoped tables (direct tenant_id) ─────────────────────────────────

DO $$ BEGIN
  CREATE POLICY "Tenant manages custom_fields"
    ON custom_fields FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages packages"
    ON packages FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages loyalty_programs"
    ON loyalty_programs FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages products"
    ON products FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages staff_roles"
    ON staff_roles FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages customer_packages"
    ON customer_packages FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages customer_loyalty_points"
    ON customer_loyalty_points FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages loyalty_transactions"
    ON loyalty_transactions FOR ALL TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Junction/child table policies (via parent FK) ───────────────────────────

DO $$ BEGIN
  CREATE POLICY "Tenant manages appointment_custom_field_values"
    ON appointment_custom_field_values FOR ALL TO authenticated
    USING (appointment_id IN (
      SELECT id FROM appointments WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages staff_holidays"
    ON staff_holidays FOR ALL TO authenticated
    USING (staff_id IN (
      SELECT id FROM staff WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages package_services"
    ON package_services FOR ALL TO authenticated
    USING (package_id IN (
      SELECT id FROM packages WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages loyalty_rules"
    ON loyalty_rules FOR ALL TO authenticated
    USING (loyalty_program_id IN (
      SELECT id FROM loyalty_programs WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages product_services"
    ON product_services FOR ALL TO authenticated
    USING (product_id IN (
      SELECT id FROM products WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages staff_role_assignments"
    ON staff_role_assignments FOR ALL TO authenticated
    USING (role_id IN (
      SELECT id FROM staff_roles WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant manages role_permissions"
    ON role_permissions FOR ALL TO authenticated
    USING (role_id IN (
      SELECT id FROM staff_roles WHERE tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================
-- DONE. All tables, columns, indexes, RLS, and
-- policies for Phase 6 are now in place.
-- =============================================
