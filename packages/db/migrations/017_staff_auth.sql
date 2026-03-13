-- Migration 017: Staff auth support
-- Adds user_id to staff table for Supabase Auth login,
-- invite token flow, and RLS policies for staff self-service.

-- Add auth support to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT false;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invite_token text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS invite_accepted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_invite_token ON staff(invite_token);

-- RLS: staff can read/update their own row
CREATE POLICY "Staff can view own record" ON staff
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff can update own record" ON staff
  FOR UPDATE USING (auth.uid() = user_id);

-- Staff can view their own appointments
CREATE POLICY "Staff can view own appointments" ON appointments
  FOR SELECT USING (
    staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

-- Staff can update appointment status
CREATE POLICY "Staff can update own appointment status" ON appointments
  FOR UPDATE USING (
    staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );
