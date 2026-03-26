# BALKINA AI — Product Blueprint

## 1. Vision

Balkina AI is a **conversational booking platform** — not a marketplace browser. Customers interact with a single AI chatbot that discovers businesses, checks availability, books appointments, and sends reminders. No browsing, no tenant pages, no category filtering UI. Everything surfaces as rich cards within the chat conversation.

Tenants get a professional booking management dashboard rivaling Booknetic/Calendly — full service configuration, staff management, multi-location support, customer CRM, analytics, and more.

**Core differentiator**: The AI chatbot handles the entire customer journey through natural language.

---

## 2. Target Users

### Customers (Mobile App)
- People who need appointment-based services (haircuts, beauty, wellness, fitness, medical)
- Discover and book through natural language ("I need a haircut near me tomorrow afternoon")
- Receive reminders, manage bookings, leave reviews — all in-app

### Tenant Owners (Web Dashboard)
- Small-to-medium service businesses (barbershops, salons, spas, gyms, clinics)
- Manage services, staff, locations, appointments, and payments
- Self-service onboarding: register, pick a plan, start receiving AI-routed bookings

### Staff Members (Mobile App — Staff Portal)
- View assigned appointments, manage personal availability
- Approve/decline booking requests
- Track daily schedule and dashboard metrics

### Platform Admin (Admin Panel)
- Manage all tenants, subscription plans, global categories
- Monitor platform-wide metrics, customer activity
- Bulk operations and tenant support

---

## 3. Architecture

```
                    +-------------------+
                    |   Mobile App      |
                    | (React Native +   |
                    |  Expo)            |
                    |                   |
                    | Customer Chat     |
                    | Bookings          |
                    | Staff Portal      |
                    +--------+----------+
                             |
                    REST + SSE (chat streaming)
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+     +-------------v-----------+
    | Tenant Web Panel  |     |    Admin Panel          |
    | (Next.js 14)      |     |    (Next.js 14)         |
    | Vercel            |     |    Vercel                |
    +--------+----------+     +-------------+-----------+
              |                             |
              +------+------+------+--------+
                     |      |      |
              +------v--+ +-v----+ +v----------+
              |Supabase | |Stripe| | OpenAI    |
              |PostgreSQL| |Billing| | GPT-4o-  |
              |+ RLS    | |Connect| | mini      |
              +---------+ +------+ +-----------+
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo 54, Expo Router |
| Tenant Web | Next.js 14 + App Router, Vercel |
| Admin Web | Next.js 14 + App Router, Vercel |
| API | Next.js API routes (Vercel serverless) |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| AI | OpenAI GPT-4o-mini (production), Claude Sonnet (future premium) |
| Payments | Stripe Billing (subscriptions) + Stripe Connect (marketplace) |
| Email | Resend |
| SMS | Twilio |
| Push | Expo Push Notifications |
| Maps | Google Maps API |

---

## 4. Business Model

### Revenue Streams

**1. Tenant Subscriptions** (Stripe Billing)

| Plan | Price/Month | Max Staff | Max Locations | Key Features |
|------|------------|-----------|---------------|-------------|
| Starter | $29 | 3 | 1 | AI chat, basic appointment management |
| Pro | $79 | 10 | 3 | + SMS notifications, analytics |
| Enterprise | $199 | 50 | 10 | + White-label, AI nudges, priority support |

**2. Transaction Fees** (Stripe Connect)
- 10% platform commission on all customer appointment payments
- Applies to deposits and balance payments routed through Stripe Connect

### Cost Structure

AI costs at scale (100 tenants, 30 bookings/day each):

| Model | Input Rate | Output Rate | Monthly Cost | vs Revenue |
|-------|-----------|-------------|-------------|-----------|
| GPT-4o-mini | $0.15/1M | $0.60/1M | ~$440 | 44% |
| GPT-4o | $2.50/1M | $10.00/1M | ~$7,330 | 733% |
| Claude Haiku 3.5 | $0.80/1M | $4.00/1M | ~$2,430 | 243% |
| Claude Sonnet 4.6 | $3.00/1M | $15.00/1M | ~$9,120 | 912% |

GPT-4o-mini is the only viable option at current pricing. The REST-first architecture further reduces token usage by handling deterministic flows (staff availability, slot generation, booking creation) via REST endpoints rather than AI.

---

## 5. User Flows

### 5.1 Customer Booking (Chat)

```
Open App → Chat Screen
  → "I need a haircut near me"
  → AI calls find_businesses(query, location)
  → Shows business cards with distance, rating, services
  → Customer taps a business
  → AI calls get_services(tenant_id)
  → Shows service cards with pricing
  → Customer picks a service
  → AI calls check_availability(service_id, date)
  → Shows staff + time slot cards
  → Customer picks staff + time
  → AI shows summary card (service, staff, time, price, deposit)
  → Customer confirms ("Yes, book it")
  → AI calls create_booking(...)
  → Shows confirmed card with details
  → Push notification reminder 24h + 2h before appointment
```

### 5.2 Customer Booking (REST — Direct)

When the customer taps through the chat UI cards (not typing), the mobile app calls REST endpoints directly to avoid unnecessary AI token usage:

```
Service selected → POST /api/booking/staff-availability
  → Returns staff list + available time slots
  → Filtered by location (auto-inferred from GPS)
  → Filtered by timezone (location-specific)
  → Past time slots excluded
Staff + slot selected → POST /api/booking/create
  → Creates appointment
  → Returns payment_client_secret if deposit required
```

### 5.3 Tenant Onboarding

```
Visit balkina.ai → Register
  → Enter: business name, owner name, email, password, phone, category
  → Supabase auth.signUp() creates auth user
  → POST /api/auth/register creates tenant record + Stripe customer
  → Redirect to /onboarding/select-plan
  → Choose Starter / Pro / Enterprise
  → Stripe Checkout session
  → Payment success → tenant status: active
  → Redirect to dashboard → set up services, staff, locations
```

### 5.4 Deposit Payment (Mobile)

**Scenario A — Auto-confirmed + deposit:**
```
Booking confirmed → PaymentSheet opens (Apple Pay / Google Pay / card)
  → Payment succeeds → booking confirmed with deposit paid
```

**Scenario B — Request + pre-authorization:**
```
Booking requested → PaymentSheet authorizes funds (manual capture)
  → Staff approves request → funds captured automatically
  → Staff declines → hold released
```

**Scenario C — Request + post-approval:**
```
Booking requested (no payment yet)
  → Staff approves → push notification: "deposit_payment_required"
  → Customer taps notification → navigates to Bookings screen
  → Taps "Pay Deposit" → PaymentSheet opens → payment completes
```

### 5.5 AI Rebooking Nudge

```
Cron job: /api/cron/behavior-analysis (daily 3 AM UTC)
  → Analyzes customer_behavior_profiles
  → Calculates avg_interval_days between bookings per customer+service
  → Sets predicted_next_date

Cron job: /api/cron/send-nudges (daily 9 AM UTC)
  → Queries profiles where predicted_next_date <= today
  → Sends push notification: "Time for your next haircut?"
  → Logs in ai_nudge_log (sent_at, opened_at, converted_at)
```

---

## 6. Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| tenants | Businesses on the platform |
| tenant_locations | Multiple physical locations per tenant |
| staff | Team members with availability schedules |
| categories | Global service taxonomy (admin-managed) |
| services | Bookable offerings with pricing and duration |
| service_extras | Optional add-ons per service |
| appointments | Booking records with payment tracking |
| customers | Mobile app users |
| customer_behavior_profiles | AI memory for rebooking predictions |
| coupons | Discount codes per tenant |
| reviews | Post-appointment ratings (1-5 stars) |
| subscription_plans | Platform pricing tiers |
| ai_nudge_log | Push notification tracking |
| stripe_webhook_events | Idempotency for payment webhooks |

### Junction Tables

| Table | Purpose |
|-------|---------|
| service_staff | Which staff can perform which services |
| staff_locations | Which staff work at which locations |
| service_locations | Which services are offered at which locations |

### Key Relationships

- Staff eligibility for a booking = `assigned to service` AND `assigned to location`
- Staff with no `staff_locations` entries = available at all locations (backward-compatible)
- `payments_enabled` (per-tenant flag) gates all deposit/payment UI and flows

### Security

- All tables have Row-Level Security (RLS) enabled
- Tenant data always filtered by `tenant_id`
- Helper functions: `get_my_tenant_id()`, `is_platform_admin()`
- Service role key only used server-side in API routes
- Anon key used in mobile/web client apps

---

## 7. Feature Matrix

### Tenant Dashboard

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|-----------|
| Service management (pricing, duration, extras, deposits) | Y | Y | Y |
| Staff management + schedules | Y (3 max) | Y (10 max) | Y (50 max) |
| Location management | 1 | 3 | 10 |
| Appointment management | Y | Y | Y |
| Customer CRM | Y | Y | Y |
| Coupon system | Y | Y | Y |
| Reviews | Y | Y | Y |
| Analytics dashboard | - | Y | Y |
| SMS notifications | - | Y | Y |
| AI rebooking nudges | - | - | Y |
| White-label | - | - | Y |
| Priority support | - | - | Y |

### Customer App

| Feature | Status |
|---------|--------|
| AI chat booking (conversational) | Implemented |
| REST-driven booking (card UI) | Implemented |
| Business discovery by location | Implemented |
| Multi-location support | Implemented |
| Deposit payment (Apple Pay / Google Pay / card) | Implemented |
| Booking management (view, cancel, reschedule) | Implemented |
| Push notification reminders | Implemented |
| Coupon application | Implemented |
| Reviews | Implemented |
| Loyalty points | Implemented (tools exist) |
| Packages (pre-paid sessions) | Implemented (tools exist) |

### Staff Portal (Mobile)

| Feature | Status |
|---------|--------|
| Dashboard with metrics | Implemented |
| Appointment management | Implemented |
| Availability settings | Implemented |
| Profile management | Implemented |

### Admin Panel

| Feature | Status |
|---------|--------|
| Tenant management (list, detail, status, payments) | Implemented |
| Tenant creation (single + bulk) | Implemented |
| Subscription plan management | Implemented |
| Global category management | Implemented |
| Customer analytics | Implemented |
| Platform statistics | Implemented |

---

## 8. AI Chatbot Specification

### Model
- **Production**: OpenAI GPT-4o-mini via function calling
- **Premium (future)**: Claude Sonnet 4.6 in `/packages/ai/`

### Behavior Rules
- Ultra-concise responses (max 1 short sentence, then cards/buttons)
- Never write paragraphs — the UI is card-driven
- Always end messages with tappable cards or buttons
- Never execute `create_booking` without explicit user confirmation
- Always show price and deposit amount before any payment
- Stream all responses (never wait for full completion)

### Available Tools (14)
1. `find_businesses` — Geo-search for businesses by query/category
2. `get_services` — List services with pricing
3. `get_service_details` — Full service details including extras
4. `get_staff` — Staff list filtered by service/location
5. `check_availability` — Time slots (max 6 per call, paginated)
6. `create_booking` — Create appointment (requires confirmation)
7. `get_booking_details` — View booking or list bookings
8. `cancel_appointment` — Cancel with policy check
9. `reschedule_appointment` — Move to new time
10. `apply_coupon` — Validate and apply discount code
11. `get_loyalty_info` — Points calculation
12. `get_packages` — Pre-paid session packages
13. `get_directions` — Google Maps link + distance
14. `get_inventory` — Stock/supply information

### Context Injection
The system prompt is dynamically built with:
- Customer profile (name, phone, email, location)
- Past bookings (recent completed/confirmed appointments)
- Behavior patterns (avg interval, predicted next booking date)
- Tenant info (services, locations, staff, payments_enabled flag)

---

## 9. Notification System

| Channel | Provider | Triggers |
|---------|----------|----------|
| Email | Resend | Booking confirmation, tenant welcome, subscription activated, payment failed |
| SMS | Twilio | Booking confirmation, appointment reminder (24h + 2h), OTP verification |
| Push | Expo | Booking confirmation, reminders, deposit payment required, AI rebooking nudge |

### Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Reminders | Every hour | Send 24h and 2h appointment reminders |
| Daily Summary | Every hour | Generate daily summary for tenants |
| Behavior Analysis | Daily 3 AM UTC | Compute rebooking predictions |
| Send Nudges | Daily 9 AM UTC | Send AI-triggered rebooking push notifications |

---

## 10. Payments Architecture

### Stripe Billing (Tenant Subscriptions)
- Three tiers: Starter ($29), Pro ($79), Enterprise ($199)
- Managed via Stripe Checkout sessions
- Webhook handles `checkout.session.completed`, `invoice.payment_failed`
- Tenant status transitions: `pending_subscription` -> `active` -> `past_due` -> `suspended`

### Stripe Connect (Customer Payments)
- Tenants connect their Stripe accounts for payouts
- Deposits create PaymentIntents with `transfer_data` to tenant account
- Platform takes 10% via `application_fee_amount`
- Manual capture mode for pre-authorization scenarios
- Webhook handles `payment_intent.succeeded`, `payment_intent.amount_capturable_updated`

### payments_enabled Flag
- Per-tenant boolean (default: false)
- When false: no deposit UI, no payment collection, no Stripe mentions in chat
- When true: full deposit + payment flow activates
- Toggle via admin panel or SQL

---

## 11. Environment & Deployment

### Deployment
- **Tenant Web + API**: Vercel (Next.js, auto-deploy from `main` branch)
- **Admin Panel**: Vercel (separate Next.js app)
- **Mobile**: Expo (EAS Build for production, Expo Go for development)
- **Database**: Supabase (hosted PostgreSQL)

### Key Environment Variables
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, plan price IDs, Connect client ID
- Notifications: `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- AI: `OPENAI_API_KEY` (production), `ANTHROPIC_API_KEY` (premium/future)
- Maps: `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Auth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- Cron: `CRON_SECRET`

All validated with Zod on startup via `/packages/config/src/env.ts`.

---

## 12. Roadmap

### Completed
- AI chatbot with function calling (14 tools)
- Multi-location business support
- REST-first booking architecture
- Stripe subscriptions + Connect payments
- Mobile deposit payment (PaymentSheet)
- Staff portal (mobile)
- Admin panel with tenant management
- Notification system (email, SMS, push)
- Behavior analysis + rebooking nudges (cron)
- Customer CRM
- Coupon system
- Review system

### Post-Launch Priorities
1. **Testing** — Unit tests (shared utils), integration tests (API routes), E2E (Playwright)
2. **Email templates package** — Dedicated templates with tenant branding support
3. **White-label** — Tenant-customized chat experience for Enterprise tier
4. **Analytics v2** — Advanced dashboards, revenue forecasting, staff performance
5. **Premium AI tier** — Claude Sonnet integration for enhanced conversational quality
6. **Multi-language** — i18n for chat and UI
7. **Waitlist / queue management** — For high-demand time slots
8. **Group bookings** — Multiple participants per appointment
