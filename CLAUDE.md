## Non-Negotiable Build Rule
BEFORE committing ANY code, ALWAYS run `npm run build` from the repo root and fix ALL errors until the build passes. Never commit code that fails to build. This is the most important rule in this file.

If a build error occurs:
1. Read the full error message
2. Fix the root cause (not just the symptom)
3. Run `npm run build` again
4. Repeat until zero errors
5. Only then commit and push

Never use Vercel as your test environment. The build must pass locally before any push.

# BALKINA AI — Claude Code Instructions

## Project Overview
Balkina AI is an AI-powered appointment booking marketplace hosted at balkina.ai. Single unified platform — all customer discovery and booking happens through an AI chatbot. Tenants have a robust management panel but customers never visit individual tenant pages. Mobile-first (React Native + Expo). Full blueprint in /docs/BLUEPRINT.md.

## Stack
- Mobile: React Native + Expo (Expo Router for navigation)
- Web (Tenant Panel): Next.js 14 + App Router on Vercel
- Admin: Next.js 14 on Vercel
- API: Node.js Express, deployed as Vercel serverless functions in /apps/api
- DB: Supabase (PostgreSQL). ALL queries use Supabase client. NEVER raw SQL in app code.
- AI: OpenAI GPT-4o-mini with function calling for the customer chatbot (cost-optimized). Claude integration exists in /packages/ai as a premium option for future use.
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
/packages/ai       — AI integration (Claude premium option), tool definitions, memory engine
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

## AI Chatbot Rules
- **Production model: OpenAI GPT-4o-mini** via `/apps/web/src/app/api/chat/route.ts` with function calling.
- Cost analysis (100 tenants, 30 bookings/day): GPT-4o-mini ~$440/mo vs Claude Haiku ~$2,430/mo vs Claude Sonnet ~$9,120/mo. GPT-4o-mini is the only viable option at $10/tenant pricing.
- `/packages/ai/` contains a Claude API integration (claude-sonnet-4-6) preserved as a premium tier option for future use. It is NOT the active chat backend.
- Tool definitions live inline in the chat route (OpenAI function calling format). The `/packages/ai/tools/` definitions are Claude-format equivalents.
- System prompt built in the chat route — injects customer profile, location, past bookings, behavior patterns.
- NEVER execute create_booking or process_payment tools without an explicit user confirmation message in the conversation immediately prior.
- Always show price and deposit amount before any payment tool call.
- Stream all responses. Never wait for full completion before rendering.

## Feature Flags

### payments_enabled (per-tenant)
- **Column**: `tenants.payments_enabled` (BOOLEAN, default false) — Migration 025.
- **Purpose**: Gates deposits, Stripe Connect payments, and checkout for regions where Stripe is not available.
- **When false**:
  - Deposit calculation is skipped in chat (`tool-handlers.ts`) and REST (`/api/booking/create`) booking flows.
  - "Enable Deposit" toggle is hidden in the service form (`service-form.tsx`).
  - Chat system prompt tells the AI not to mention deposits or online payments.
  - Bookings are created with `deposit_amount_paid: null`, `balance_due: null`.
- **When true**: Full deposit + Stripe payment flow activates. No code changes needed.
- **How to toggle**:
  ```sql
  -- Enable payments for a tenant
  UPDATE tenants SET payments_enabled = true WHERE id = '<tenant-id>';
  -- Disable payments for a tenant
  UPDATE tenants SET payments_enabled = false WHERE id = '<tenant-id>';
  -- Check current state
  SELECT id, name, payments_enabled FROM tenants;
  ```
- **Files involved**: `tool-handlers.ts`, `booking/create/route.ts`, `chat/route.ts`, `service-form.tsx`, `services/page.tsx`, `packages/shared/src/types/index.ts`.

## Stripe Native Payments (Mobile)

### Current Setup
The mobile app uses `@stripe/stripe-react-native` for native in-app deposit payments via PaymentSheet (Apple Pay, Google Pay, card entry). However, this SDK requires **native modules** that are NOT available in Expo Go.

### Expo Go Compatibility Wrapper
All Stripe imports go through `apps/mobile/lib/stripe.tsx` — a safe wrapper that:
- Tries to load the real `@stripe/stripe-react-native` at runtime
- If native modules are missing (Expo Go), falls back to no-op stubs that show an alert: "Stripe payments require a development build"
- Exports `SafeStripeProvider` (used in `_layout.tsx`) and `useStripe()` (used in `index.tsx`, `bookings.tsx`, `useDepositPayment.ts`)

**NEVER import directly from `@stripe/stripe-react-native` in component files.** Always import from `@/lib/stripe`.

### When Ready to Test Actual Payments
1. **Use a development build**, not Expo Go:
   ```bash
   # iOS
   npx expo run:ios
   # Android
   npx expo run:android
   # Or use EAS Build
   eas build --profile development --platform ios
   ```
2. **Ensure `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`** is set in `apps/mobile/.env`
3. **Ensure the Stripe plugin** is in `app.json` under `plugins` (it already is):
   ```json
   ["@stripe/stripe-react-native", { "merchantIdentifier": "merchant.com.tseggaid.balkinaai", "enableGooglePay": true }]
   ```
4. **Version compatibility**: Expo 54 expects `@stripe/stripe-react-native@0.50.3`. If you see warnings, run:
   ```bash
   npx expo install @stripe/stripe-react-native
   ```
   This will install the Expo-compatible version.
5. **Apple Pay** requires the merchant ID (`merchant.com.tseggaid.balkinaai`) to be configured in your Apple Developer account and Stripe dashboard.

### Payment Flows (3 scenarios)
- **Auto-confirmed + deposit**: Chat summary card shows "Pay deposit to confirm booking" -> PaymentSheet -> confirmation screen
- **Request + pre-auth (Scenario 1)**: PaymentSheet authorizes funds (manual capture) -> request sent -> staff approves -> funds captured automatically
- **Request + post-approval (Scenario 2)**: Normal request -> staff approves -> push notification `deposit_payment_required` -> customer taps -> navigates to Bookings -> in-app PaymentSheet

### Files involved
- `apps/mobile/lib/stripe.tsx` — Safe wrapper (SafeStripeProvider, useStripe)
- `apps/mobile/lib/useDepositPayment.ts` — Reusable payment hook
- `apps/mobile/app/_layout.tsx` — SafeStripeProvider at root
- `apps/mobile/app/(app)/index.tsx` — Chat flow PaymentSheet integration
- `apps/mobile/app/(app)/bookings.tsx` — Bookings screen Pay Deposit button + notification deep-link
- `apps/mobile/app/(app)/_layout.tsx` — `deposit_payment_required` notification deep-link handler
- `apps/web/src/app/api/payments/create-deposit/route.ts` — Creates/retrieves PaymentIntent
- `apps/web/src/app/api/booking/create/route.ts` — Returns `payment_client_secret`, uses `capture_method: 'manual'` for requests
- `apps/web/src/app/api/chat/tool-handlers.ts` — Chat booking flow PaymentIntent creation
- `apps/web/src/app/api/staff/appointments/[id]/status/route.ts` — Captures held funds or sends deposit notification on approval
- `apps/web/src/app/api/webhooks/stripe/route.ts` — Handles `payment_intent.succeeded` and `payment_intent.amount_capturable_updated`

## Stripe Rules (/packages/billing)
- Webhook handler: /packages/api/routes/webhooks/stripe.ts
- Always verify webhook signature with stripe.webhooks.constructEvent() before processing.
- Check stripe_webhook_events table before processing any event — skip if already processed (idempotency).
- Tenant subscription logic in /packages/billing/subscriptions.ts
- Customer payment logic in /packages/billing/appointments.ts
- Deposit flow: create PaymentIntent for deposit_amount only, transfer_data to tenant stripe_account_id minus commission.

## Testing Requirements
- Testing deferred to post-launch. Will implement in phases:
  - Phase 1: Unit tests for utility functions in /packages/shared/utils
  - Phase 2: Integration tests for API routes using supertest
  - Phase 3: E2E tests for critical flows using Playwright
- Manual testing is acceptable during development and test mode.

## Git Workflow
- Branch naming: feature/feature-name, fix/bug-description, chore/task-name
- Commit messages: feat: description | fix: description | chore: description
- Commit directly to main for all bug fixes. Only create feature branches for full phase builds (feat/phase-X-name).
- PR must include: what changed, how tested, screenshots for any UI changes.
- .env.local is gitignored. Never commit any credentials.

## Product Vision

Balkina AI is NOT a marketplace browser. It is a conversational booking platform.

**Customer experience**: One chat interface. Users ask, AI finds businesses, checks availability, books appointments, sends reminders. No browsing, no tenant pages, no category filtering UI. Everything surfaces as rich cards within the chat conversation.

**Tenant experience**: Professional booking management dashboard rivaling Booknetic/Calendly. Full service configuration (images, colors, deposits, buffer times, extras, booking limits), staff management with schedules, location management, appointment management, customer CRM, coupon system, analytics.

**Core differentiator**: The AI chatbot that handles the entire customer journey through natural language.

## Database Tables — New (Migration 006)
- service_staff — id, service_id, staff_id (junction table for which staff can perform which services)
- service_special_days — id, service_id, date, start_time, end_time, is_day_off, breaks (jsonb)
- services extended columns: image_url, color, description, buffer_time_before, buffer_time_after, custom_duration, is_recurring, capacity, hide_price, hide_duration, visibility, min_booking_lead_time, max_booking_days_ahead, min_extras, max_extras, booking_limit_per_customer, booking_limit_per_customer_interval, booking_limit_per_slot, booking_limit_per_slot_interval, category_name, timesheet (jsonb)
- staff extended columns: image_url, status

## Mobile App Structure (Conversational-First)
```
apps/mobile/app/
├── _layout.tsx        — Root layout, auth state listener, redirects
├── (auth)/            — Login, register screens
│   ├── _layout.tsx
│   ├── welcome.tsx
│   ├── email-login.tsx
│   ├── phone-login.tsx
│   ├── verify-otp.tsx
│   └── profile-setup.tsx
└── (app)/             — Main app (chat-first)
    ├── _layout.tsx    — Bottom tabs: Chat | Bookings | Profile
    ├── index.tsx      — CHAT SCREEN (this is home, not a list)
    ├── bookings.tsx   — Upcoming/past appointments
    └── profile.tsx    — User profile and settings
```

## Chat API — Tenant Discovery
The /api/chat endpoint accepts tenantId as OPTIONAL. When no tenantId is provided:
- AI acts as a general booking assistant
- Uses find_businesses tool to search for matching tenants
- Once user picks a business, proceeds with normal booking flow

## When Stuck
- Check /docs/ for detailed module specs.
- Check /packages/shared/types before creating new types.
- Check /packages/db/rls-policies.sql for RLS policy patterns.
- Do not install new npm packages without checking if existing dependencies cover the need.
- If a Supabase query returns unexpected results, check RLS policies first.
