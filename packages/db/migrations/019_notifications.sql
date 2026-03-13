-- Customer push tokens
CREATE TABLE IF NOT EXISTS customer_push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, token)
);
ALTER TABLE customer_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers manage own push tokens" ON customer_push_tokens
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- Staff push tokens
CREATE TABLE IF NOT EXISTS staff_push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(staff_id, token)
);
ALTER TABLE staff_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage own push tokens" ON staff_push_tokens
  FOR ALL USING (
    staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

-- Notification preferences on customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS notify_sms boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT false;

-- Notification preferences on staff
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS notify_sms boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push boolean DEFAULT true;

-- Notification audit log
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_type text CHECK (recipient_type IN ('customer', 'staff')),
  recipient_id uuid NOT NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  channel text CHECK (channel IN ('sms', 'push', 'email')),
  status text CHECK (status IN ('sent', 'failed', 'skipped')),
  sent_at timestamptz DEFAULT now(),
  error_text text
);
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Reminder deduplication table
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  reminder_type text CHECK (reminder_type IN ('24hr', '2hr')),
  sent_at timestamptz DEFAULT now(),
  UNIQUE(appointment_id, reminder_type)
);
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
