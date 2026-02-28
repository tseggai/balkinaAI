# BALKINA AI — Claude Code Instructions

## Project Overview
Balkina AI is an AI-powered appointment booking marketplace hosted at balkina.ai. Single unified platform — all customer discovery and booking happens through an AI chatbot. Tenants have a robust management panel but customers never visit individual tenant pages. Mobile-first (React Native + Expo). Full blueprint in /docs/BLUEPRINT.md.

## Stack
- Mobile: React Native + Expo (Expo Router for navigation)
- Web (Tenant Panel): Next.js 14 + App Router on Vercel
- Admin: Next.js 14 on Vercel
- API: Node.js Express, deployed as Vercel serverless functions in /apps/api
- DB: Supabase (PostgreSQL). ALL queries use Supabase client. NEVER raw SQL in app code.
- AI: Claude API (claude-sonnet-4-6) with tool use. See /packages/ai for integration.
- Payments: Stripe. Two flows: (1) Tenant subscriptions via Stripe Billing, (2) Customer appointment payments via Stripe Connect.
- Email: Resend. Templates in /packages/email-templates.
- SMS: Twilio. Used for booking confirmations, reminders, and OTP.
- Push: Expo Push Notifications. Used for AI memory triggers.
- Maps: Google Maps API. Used for geo-search and location autocomplete.

## Repo Structure
```
/apps/web          — Next.js 14 tenant management panel
/apps/admin        — Next.js 14 platform admin panel
/apps/mobile       — React Native + Expo customer chatbot app
/packages/api      — Express API routes (Vercel serverless functions)
/packages/db       — Supabase client, migrations, type generation
/packages/ai       — Claude API integration, tool definitions, memory engine
/packages/shared   — Types, utils, constants shared across all apps
/packages/billing  — Stripe subscription and Connect payment logic
/packages/notifications — Resend email + Twilio SMS + Expo push
/packages/config   — Zod-validated environment variables
/docs              — Feature specs and architecture docs
```

## Code Standards
- TypeScript everywhere. Strict mode ON. Zero type errors tolerated.
- Zod for all input validation at API boundaries.
- Never expose service role key client-side. Only anon key in mobile/web apps.
- All DB operations respect Supabase RLS. Never bypass with service role except in secure server-side API routes.
- API routes always validate auth via supabase.auth.getUser() before any data operation.
- Use TanStack Query (react-query) for all data fetching in web and mobile.
- Shared types live in /packages/shared/types. Import from there, never redefine elsewhere.
- Environment variables validated with Zod in /packages/config/env.ts on startup. App fails fast if any required var is missing.

## Environment Variables
All env vars are in Vercel. Locally they live in .env.local (never committed to git).
NEXT_PUBLIC_ prefix required for any var used client-side.
Key vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_STARTER, STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_ENTERPRISE, STRIPE_CONNECT_CLIENT_ID, RESEND_API_KEY, RESEND_FROM_EMAIL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, EXPO_PROJECT_ID, ANTHROPIC_API_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL

## File Structure Rules
- One component per file. No exceptions.
- Screen components in /screens/, reusable UI components in /components/.
- API routes follow REST conventions: GET /services, POST /appointments, PATCH /appointments/:id, DELETE /appointments/:id.
- DB migrations in /packages/db/migrations/, named sequentially: 001_initial_schema.sql, 002_add_deposits.sql, etc.
- Never import from /apps/* in /packages/* — packages must be self-contained.

## Database Tables (Supabase/PostgreSQL)
All tables require RLS enabled. Tenant data always filtered by tenant_id.
- tenants — id, name, stripe_customer_id, stripe_account_id, subscription_plan_id, status, created_at
- tenant_locations — id, tenant_id, name, address, lat, lng, timezone
- staff — id, tenant_id, name, email, phone, availability_schedule (jsonb)
- categories — id, parent_id, name, slug, icon_url, display_order (global taxonomy, admin-managed)
- services — id, tenant_id, category_id, name, duration_minutes, price, deposit_enabled, deposit_type, deposit_amount
- service_extras — id, service_id, name, price, duration_minutes
- appointments — id, customer_id, tenant_id, service_id, staff_id, location_id, start_time, end_time, status, total_price, deposit_paid, deposit_amount_paid, balance_due, stripe_payment_intent_id
- customers — id (auth.users), display_name, phone, email, push_token, location_sharing_enabled
- customer_behavior_profiles — id, customer_id, tenant_id, service_id, avg_interval_days, last_booking_date, predicted_next_date
- coupons — id, tenant_id, code, discount_type, discount_value, expires_at, usage_count, usage_limit
- reviews — id, appointment_id, customer_id, tenant_id, staff_id, rating, comment, created_at
- subscription_plans — id, name, price_monthly, stripe_price_id, max_staff, max_locations, features (jsonb)
- ai_nudge_log — id, customer_id, tenant_id, trigger_type, sent_at, opened_at, converted_at
- stripe_webhook_events — id, stripe_event_id, processed_at (for idempotency)

## AI Chatbot Rules (/packages/ai)
- All Claude API calls in /packages/ai/chat.ts using streaming.
- Model: claude-sonnet-4-6 only.
- System prompt built in /packages/ai/system-prompt.ts — injects customer profile, location, past bookings, behavior patterns.
- Tool definitions in /packages/ai/tools/ — one file per tool, 11 tools total.
- NEVER execute create_booking or process_payment tools without an explicit user confirmation message in the conversation immediately prior.
- Always show price and deposit amount before any payment tool call.
- Stream all responses. Never wait for full completion before rendering.

## Stripe Rules (/packages/billing)
- Webhook handler: /packages/api/routes/webhooks/stripe.ts
- Always verify webhook signature with stripe.webhooks.constructEvent() before processing.
- Check stripe_webhook_events table before processing any event — skip if already processed (idempotency).
- Tenant subscription logic in /packages/billing/subscriptions.ts
- Customer payment logic in /packages/billing/appointments.ts
- Deposit flow: create PaymentIntent for deposit_amount only, transfer_data to tenant stripe_account_id minus commission.

## Testing Requirements
- Unit tests for all utility functions in /packages/shared/utils.
- Integration tests for all API routes using supertest.
- E2E tests for critical flows using Playwright: tenant registration, service creation with deposit, customer booking via chatbot, payment flow.
- Run npm test from repo root before any PR. All tests must pass.

## Git Workflow
- Branch naming: feature/feature-name, fix/bug-description, chore/task-name
- Commit messages: feat: description | fix: description | chore: description
- Never commit directly to main. Always open a PR.
- PR must include: what changed, how tested, screenshots for any UI changes.
- .env.local is gitignored. Never commit any credentials.

## When Stuck
- Check /docs/ for detailed module specs.
- Check /packages/shared/types before creating new types.
- Check /packages/db/rls-policies.sql for RLS policy patterns.
- Do not install new npm packages without checking if existing dependencies cover the need.
- If a Supabase query returns unexpected results, check RLS policies first.
```

---

Scroll down and click **"Commit changes"** → commit message:
```
chore: add CLAUDE.md project instructions
