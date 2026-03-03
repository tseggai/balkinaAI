-- =============================================================================
-- Migration: 008_chat_sessions_nullable_tenant.sql
-- Fix: Allow chat_sessions.tenant_id to be NULL for discovery mode
-- When customers chat without selecting a specific business, tenant_id is NULL.
-- =============================================================================

ALTER TABLE chat_sessions ALTER COLUMN tenant_id DROP NOT NULL;
