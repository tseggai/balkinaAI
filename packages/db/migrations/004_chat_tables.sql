-- =============================================================================
-- Migration: 004_chat_tables.sql
-- Phase 4: AI Chatbot — chat sessions and messages
-- =============================================================================

-- ─── chat_sessions ──────────────────────────────────────────────────────────

CREATE TABLE chat_sessions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID        REFERENCES customers(id) ON DELETE SET NULL,
  session_id  TEXT        NOT NULL UNIQUE,
  customer_name  TEXT,
  customer_phone TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chat_sessions_tenant_id   ON chat_sessions(tenant_id);
CREATE INDEX idx_chat_sessions_session_id  ON chat_sessions(session_id);
CREATE INDEX idx_chat_sessions_customer_id ON chat_sessions(customer_id) WHERE customer_id IS NOT NULL;

CREATE TRIGGER set_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Allow public read/insert for widget (anonymous users can chat)
CREATE POLICY "Anyone can create chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read their own chat session by session_id"
  ON chat_sessions FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update their own chat session"
  ON chat_sessions FOR UPDATE
  USING (true);

-- ─── chat_messages ──────────────────────────────────────────────────────────

CREATE TABLE chat_messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT        NOT NULL DEFAULT '',
  tool_calls  JSONB,
  tool_results JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(session_id, created_at);

-- Allow public read/insert for widget (anonymous chat)
CREATE POLICY "Anyone can insert chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read chat messages"
  ON chat_messages FOR SELECT
  USING (true);
