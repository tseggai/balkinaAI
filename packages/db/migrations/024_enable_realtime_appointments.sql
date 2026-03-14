-- Enable Supabase Realtime for the appointments table.
-- Without this, postgres_changes subscriptions receive no events.
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
