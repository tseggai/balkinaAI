-- Voice input (mobile chat): one row per transcribed voice message, used to rate-limit
-- POST /api/voice/transcribe per user. Service role only; the audio itself is never stored.
create table if not exists voice_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  bytes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists voice_usage_user_created_idx on voice_usage (user_id, created_at desc);
alter table voice_usage enable row level security;
