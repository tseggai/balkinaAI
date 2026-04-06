-- Migration: Beta waitlist for collecting early business signups

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  category TEXT,
  location TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  postal_code TEXT,
  staff_count INTEGER DEFAULT 1,
  services_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'onboarded', 'declined')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for admin lookups
CREATE INDEX idx_waitlist_status ON waitlist(status);
CREATE INDEX idx_waitlist_created ON waitlist(created_at DESC);

-- RLS: only service role can read/write (admin operations)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (the join form submits without auth)
CREATE POLICY "Anyone can submit to waitlist"
  ON waitlist FOR INSERT
  WITH CHECK (true);

-- Only service role can read/update (admin panel)
CREATE POLICY "Service role can manage waitlist"
  ON waitlist FOR ALL
  USING (auth.role() = 'service_role');
