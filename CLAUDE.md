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

## REST-First Pattern
The mobile app uses **REST endpoints for all deterministic flows** (staff availability, time slots, booking creation) and reserves the AI chat for conversational discovery only. This avoids unnecessary token usage.

- `/api/booking/staff-availability` — Mobile calls this REST endpoint directly for staff list + time slots (NOT the AI chat's `check_availability` tool)
- `/api/booking/create` — Direct REST call for booking creation
- AI chat tools (`check_availability`, `get_staff`, `create_booking`) are only used when the customer is interacting through the chat interface

**Rule**: If a flow is deterministic (fixed inputs → fixed outputs), use a REST endpoint. Only use AI where natural language understanding or conversational context is needed.

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
- Cost analysis (100 tenants, 30 bookings/day): GPT-4o-mini ~$440/mo vs GPT-4o ~$7,330/mo vs Claude Haiku ~$2,430/mo vs Claude Sonnet ~$9,120/mo. GPT-4o-mini is the only viable option at $10/tenant pricing.
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

## Deployment
- **Marketing site (apps/marketing)**: Serves the root domain **balkina.ai** (separate Vercel project, root directory `apps/marketing`). Public pages: landing, pricing, `/b/<business>` web booking, `/p/` property portals (custom domains), `/deck` pitch deck.
- **Tenant Panel (apps/web)**: Deployed to Vercel as `balkina-ai` project. Live at **app.balkina.ai** (also balkina-ai.vercel.app).
- **Admin Panel (apps/admin)**: Deployed to Vercel as a separate project, root directory `apps/admin`. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY`.

## When Stuck
- Check /docs/ for detailed module specs.
- Check /packages/shared/types before creating new types.
- Check /packages/db/rls-policies.sql for RLS policy patterns.
- Do not install new npm packages without checking if existing dependencies cover the need.
- If a Supabase query returns unexpected results, check RLS policies first.

## Property Owner (White-Label Property) Feature — Current Understanding
A **property** is a white-label operator (resort, hotel, mall, food hall) that manages many tenant businesses under one branded portal. Restaurants are a common property tenant and the motivation for the Restaurant Booking feature below.

- **Billing (property pays Balkina)**: Migrations 044/046. Tiers: **Essentials** ($299, 5 included businesses) and **Premium** ($499, 20 included), with per-business overage billed via `PROPERTY_SEAT_PRICE_ID`. Env vars live in the `balkina-ai` Vercel project: `PROPERTY_PRICE_ID_ESSENTIALS`, `PROPERTY_PRICE_ID_PREMIUM`, `PROPERTY_SEAT_PRICE_ID`, `PROPERTY_INCLUDED_SEATS_ESSENTIALS=5`, `PROPERTY_INCLUDED_SEATS_PREMIUM=20`. Columns on `properties`: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `seats`, `stripe_seat_item_id`.
- **Membership**: businesses join a property via `property_tenants`; onboarding via `property_invites` and property applications (`/api/property/[slug]/applications/[id]`). Applications auto-create the tenant, an **owner staff record**, and a default location.
- **Portal**: custom-domain white-label site where AI discovery is **scoped to the property's businesses** (`handlePropertyFindBusinesses` in `chat/tool-handlers.ts`), never the global tenant pool.
- **Also**: property messaging (043/045), property waitlist (042). Property dashboard lives in `apps/web` at `/property/[slug]`.

## Restaurant Booking (Phase 1) — Blueprint
Goal: let restaurant tenants take bookings through Balkina **without integrating their external table-management system**, reusing the existing appointments/approval/deposit engine. Two **cleanly separated** flows, switched by a single new column.

### Core model — `services.service_type`
Add `services.service_type TEXT NOT NULL DEFAULT 'standard'` — values `'standard' | 'event' | 'table'`. This one column drives the service form (which fields show), the booking flow, pricing, and approval. The appointment's `booking_type` (Migration 047) is derived from the service's `service_type` at booking time.

**Phase 1 deliberately adds NO new "table"/"section"/"resource" entities.** Real table inventory + turn-times is Phase 2. In Phase 1, the **owner staff record acts only as the approver/notification target** — never as a table or hours source. Decisions reached:
- **Hours of operation** → the **service `timesheet`** (for restaurants), NOT staff hours. Do **not** migrate salon hours off staff — staff-hours remains correct for standard resource businesses. The split (service-hours for restaurants, staff-hours for salons) is intentional and selected by `service_type`.
- **Approval policy** → derived from `service_type` (`'table'` ⇒ request/pending; `'event'` ⇒ instant). Not the staff `requires_approval` flag.
- **Approver / who is notified** → the **owner staff record** (a real person). The owner may reassign to another staff (host/server) via the appointment edit panel.
- **Contract**: `service_type` of `'event'`/`'table'` MUST bypass the staff-hours slot engine (`check_availability` / staff `availability_schedule`), or the owner's default 9–5 schedule leaks in.

### Already built (Phase 1 backbone — done, Migration 047)
- `appointments.booking_type` (`'service'|'table'|'event'|'private_dining'`, default `'service'`) + `appointments.party_size`. `BookingType` in `/packages/shared`.
- `create_booking` chat tool + `/api/booking/create` accept/store `booking_type` + `party_size`; REST skips the 1:1 time-conflict check for non-`service` types.
- AI system prompts collect party size and frame tables/events as request-based.
- Display chips on customer mobile bookings, web dashboard appointments, and mobile tenant appointments.

### Flow A — Event / Set Menu (`service_type='event'`)
An event is a **ticket sale**: capacity-gated, instant-confirm, prepaid. **No staff.**
- **Maps to**: service = the event (Brunch, NYE Dinner, tasting menu). `price` = per head; `pricing_type='per_person'` ⇒ `total = price × party_size`. `capacity` = total seats/covers (the inventory). `deposit` = prepay. `duration` = seating length. `is_recurring` = one-off (off) vs recurring (on). `timesheet` window start = a **seating** (not a slot grid). `service_extras` = add-ons. `booking_limit_per_customer` = max seats per customer.
- **New field**: **Event date(s)** for one-offs → writes `service_special_days` (date + start_time). Recurring events use `is_recurring` + `timesheet` (day-of-week); the customer picks which occurrence date. **Finalized**: a non-recurring event REQUIRES at least one Event date (stored in `service_special_days`, using `date`+`start_time` only; `is_day_off`/`breaks` are N/A for events).
- **Event-type descriptor**: reuse `service_category`, **relabeled "Event type"** in event mode, with presets (Breakfast, Brunch, Lunch, Dinner, Special Event, Tasting Menu, Holiday). Shown as a tag under the name on the form and customer cards (e.g. "NYE Gala · *Dinner*"). The entity label is **"Experience"**.
- **Hidden fields**: Staff selection tab, "allow choose staff", custom duration, per-slot limiter (superseded by `capacity`).
- **Availability = capacity check** (NOT the slot engine): `seats_left = capacity − SUM(party_size) WHERE service_id=event AND start_time=seating AND status IN ('pending','approved','confirmed')`; bookable iff `seats_left ≥ party_size`.
- **Confirmation**: instant (`status='confirmed'`) when seats remain; deposit via the existing Stripe deposit flow. `staff_id` = null. `booking_type='event'`.
- **Defaults (open to revisit)**: v1 supports a single seating per event date (multiple seatings = repeat the date/window); events are instant-confirm-with-optional-deposit (no approval).

### Flow B — Request-Only Table (`service_type='table'`)
A request is a **reservation the venue confirms**: open-hours-based, staff-approved, pay-later. **No staff resource, no capacity enforcement in Phase 1.**
- **Maps to**: service = "Table Reservation". `duration` = turn time. `timesheet` = **open hours**. `booking_limit_per_customer` = max active reservations. Optional `deposit` = no-show hold. Optional `booking_limit_per_slot` = soft buffer (allocation released to Balkina). Optional `service_extras` = pre-order.
- **Hidden / N/A fields**: Price (free), pricing_type, capacity, is_recurring, custom duration, "allow choose staff", Staff selection tab.
- **Availability**: do **not** generate slots via the staff-hours engine. Validate the requested time is **within the service `timesheet` open hours**; the venue confirms. Overlapping requests at the same time are allowed (the REST conflict-skip already covers non-`service` types; ensure the chat path also does not block).
- **Confirmation**: always `status='pending'`; approval required (from `service_type='table'`). Owner staff = approver/notification recipient; may reassign on approval. `party_size` = guests. `booking_type='table'`.

### Restaurant vocabulary / labels (Option A + B)
- `tenants.business_type TEXT NOT NULL DEFAULT 'service'` (`'service' | 'hospitality'`). Migration 049 introduced this as `'standard' | 'restaurant'`; **Migration 050 renamed the buckets** to the broader `service` (appointments & bookings) / `hospitality` (reservations & events) so the second bucket covers cafés/bars, event venues, and hotels — not just restaurants. `getLabels`/`normalizeBusinessType` in `/packages/shared` map the legacy values for safety.
- Central `LABELS` map in `/packages/shared` keyed by `business_type` (single source of truth). Mapping for `hospitality`: service→"Experience", services→"Menu", staff→"Host", book→"Reserve", appointment→"Reservation".
- **Option A (do first)**: inject hospitality vocabulary into the AI chat system prompt when `business_type='hospitality'` (smallest change, biggest customer-facing impact).
- **Categories taxonomy (Migration 050)**: `categories.business_type` (`'service' | 'hospitality'`) splits the taxonomy. Registration shows only the categories matching the chosen bucket, grouped under their parent. Hospitality group children: Restaurant, Café / Bar, Events Venue / Private Dining, Hotel / Resort.
- **Onboarding plans**: `/onboarding/select-plan` is driven from `/api/plans` → the admin-managed `subscription_plans` table (same source as the marketing pricing page), and `/api/checkout` looks up the Stripe price by `planId`. Plans without a `stripe_price_id` are hidden. Do NOT hardcode plan names in onboarding (the old Starter/Pro/Enterprise hardcode caused "Plan not configured").
- **Option B (then)**: point tenant-dashboard headings/nav and customer chat cards at the same `LABELS` map. Skip per-tenant custom terminology (Option C) until requested.

### Pending build tasks (suggested order)
1. **Events first** (self-contained, no engine change, high-ticket): `services.service_type` migration + service-form type switch with per-type show/hide/relabel; Event date field → `service_special_days`; per-person pricing; capacity check; instant-confirm + deposit.
2. **Request tables**: service-timesheet open-hours + "within hours" validation; approval-from-`service_type`; bypass staff slot engine; owner staff as approver; chat path overlap allowance.
3. **Vocabulary**: `tenants.business_type` + `LABELS` map + AI prompt vocab + dashboard/chat labels.
4. **Onboarding consolidation** (below) — parallel, benefits all businesses.

## Tenant Onboarding Consolidation (waitlist + self-serve)
Today the **owner staff record + default location + default schedule** are auto-provisioned only on managed paths (`admin/waitlist/setup`, property applications) — **not** on self-serve `auth/register` (which relies on the onboarding wizard to prompt). This is needed by **all** businesses (a tenant can't take bookings without a staff record).

- Extract a single server-side `provisionTenantDefaults(tenantId, owner)` helper (service-role) that creates: the **owner staff** (active, `user_id` linked, default schedule), a **default location**, and anything else the waitlist setup does. Make it **idempotent** (skip if owner-staff already exists).
- Call it from **all three** onboarding paths (waitlist setup, property applications, self-serve) so they cannot drift. Wire self-serve at the server-side tenant-creation point (not client register code).
- Before building, audit `apps/admin/.../waitlist/setup/route.ts` to enumerate the full set of provisioned defaults to port.
