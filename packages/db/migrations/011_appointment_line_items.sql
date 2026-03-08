-- Migration 011: Junction tables for appointment extras, products, and coupons
-- These tables store the extras, products, and coupons selected for each appointment.

-- appointment_extras: tracks which extras were selected for an appointment
CREATE TABLE IF NOT EXISTS appointment_extras (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID     NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  extra_id    UUID        NOT NULL REFERENCES service_extras(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  price       NUMERIC     NOT NULL DEFAULT 0,
  duration_minutes INT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(appointment_id, extra_id)
);

ALTER TABLE appointment_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage appointment extras"
  ON appointment_extras FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      JOIN tenants t ON t.id = a.tenant_id
      WHERE a.id = appointment_extras.appointment_id
        AND t.user_id = auth.uid()
    )
  );

-- appointment_products: tracks which products and quantities were selected
CREATE TABLE IF NOT EXISTS appointment_products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID     NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  price       NUMERIC     NOT NULL DEFAULT 0,
  quantity    INT         NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(appointment_id, product_id)
);

ALTER TABLE appointment_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage appointment products"
  ON appointment_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      JOIN tenants t ON t.id = a.tenant_id
      WHERE a.id = appointment_products.appointment_id
        AND t.user_id = auth.uid()
    )
  );

-- appointment_coupons: tracks which coupon was applied to an appointment
CREATE TABLE IF NOT EXISTS appointment_coupons (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID     NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  coupon_id   UUID        NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  discount_type TEXT      NOT NULL,
  discount_value NUMERIC  NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(appointment_id, coupon_id)
);

ALTER TABLE appointment_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can manage appointment coupons"
  ON appointment_coupons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      JOIN tenants t ON t.id = a.tenant_id
      WHERE a.id = appointment_coupons.appointment_id
        AND t.user_id = auth.uid()
    )
  );
