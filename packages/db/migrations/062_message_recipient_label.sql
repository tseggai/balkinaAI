-- Multi-tenant / category-targeted property messages need a human label for the
-- history list (tenant_id only describes a single-recipient send).
ALTER TABLE property_messages ADD COLUMN IF NOT EXISTS recipient_label TEXT;
