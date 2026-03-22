-- Add avg_rating and review_count columns to tenants and staff tables
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(2,1) DEFAULT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(2,1) DEFAULT NULL;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Create a function that recalculates avg_rating and review_count
-- after a review is inserted, updated, or deleted
CREATE OR REPLACE FUNCTION recalculate_ratings()
RETURNS TRIGGER AS $$
DECLARE
  t_id UUID;
  s_id UUID;
BEGIN
  -- Determine tenant_id and staff_id from the affected row
  IF TG_OP = 'DELETE' THEN
    t_id := OLD.tenant_id;
    s_id := OLD.staff_id;
  ELSE
    t_id := NEW.tenant_id;
    s_id := NEW.staff_id;
  END IF;

  -- Update tenant aggregate
  IF t_id IS NOT NULL THEN
    UPDATE tenants SET
      avg_rating = sub.avg_r,
      review_count = sub.cnt
    FROM (
      SELECT
        ROUND(AVG(rating)::numeric, 1) AS avg_r,
        COUNT(*)::integer AS cnt
      FROM reviews
      WHERE tenant_id = t_id
    ) sub
    WHERE tenants.id = t_id;
  END IF;

  -- Update staff aggregate
  IF s_id IS NOT NULL THEN
    UPDATE staff SET
      avg_rating = sub.avg_r,
      review_count = sub.cnt
    FROM (
      SELECT
        ROUND(AVG(rating)::numeric, 1) AS avg_r,
        COUNT(*)::integer AS cnt
      FROM reviews
      WHERE staff_id = s_id
    ) sub
    WHERE staff.id = s_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers on the reviews table
DROP TRIGGER IF EXISTS trg_recalculate_ratings ON reviews;
CREATE TRIGGER trg_recalculate_ratings
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_ratings();
