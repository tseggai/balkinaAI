#BALKINA AI — Claude Code Instructions#

#Project OverviewBalkina AI is an AI-powered appointment booking marketplace. Single platform, AI chatbot for customer bookings, robust tenant management panel. Mobile-first (React Native + Expo). See full blueprint in /docs/BLUEPRINT.md.#

#Stack- Mobile: React Native + Expo (Expo Router for navigation)- Web (Tenant Panel): Next.js 14 + App Router on Vercel- Admin: Next.js 14 on Vercel- API: Node.js Express, deployed as Vercel serverless functions in /apps/api- DB: Supabase (PostgreSQL). ALL queries use Supabase client. NEVER raw SQL in app code.- AI: Claude API (claude-sonnet-4-6) with tool use. See /packages/ai for integration.- Payments: Stripe. Two flows: (1) Tenant subscriptions, (2) Customer payments via Stripe Connect.- Email: Resend. Templates in /packages/email-templates.- SMS: Twilio. Used for confirmations and OTP.- Push: Expo Push Notifications.#

#Code Standards- TypeScript everywhere. Strict mode ON.- Zod for all input validation at API boundaries.- Never expose service role key client-side. Only anon key in mobile/web apps.- All DB operations use Supabase RLS. Never bypass with service role unless in a secure server context.- API routes always validate auth via supabase.auth.getUser().- Use react-query (TanStack Query) for data fetching in web and mobile.- Shared types live in /packages/shared/types. Import from there, never redefine.- Environment variables: use /packages/config/env.ts which validates all vars with Zod on startup.#

#File Structure Rules- One component per file.- Screen components in /screens/, reusable components in /components/.- API routes follow REST conventions: GET /services, POST /appointments, PATCH /appointments/:id.- DB migrations in /packages/db/migrations/, named: 001_initial_schema.sql, 002_add_deposits.sql, etc.#

#Testing Requirements- Unit tests for all utility functions (/packages/shared/utils).- Integration tests for all API routes using supertest.- E2E tests for critical booking flow using Playwright (web).- Run tests before any PR: npm test from repo root.#

#Git Workflow- Branch naming: feature/feature-name, fix/bug-description, chore/task-name.- Commit messages: feat: add deposit payment flow | fix: resolve availability query bug.- Never commit directly to main. Always PR.- PR description must include: what changed, how tested, screenshot if UI change.#

#AI Chatbot Rules (packages/ai)- All Claude API calls in /packages/ai/chat.ts.- System prompt built in /packages/ai/system-prompt.ts — inject customer context here.- Tool definitions in /packages/ai/tools/ — one file per tool.- NEVER call booking or payment tools without user confirmation message in the conversation.- Stream responses for UX. Use claude-sonnet-4-6 model only.#

#Stripe Rules- Webhook handler in /apps/api/routes/webhooks/stripe.ts.- Always verify webhook signature before processing.- Idempotency: check if event already processed before acting (store processed event IDs in Supabase).- Tenant subscription logic in /packages/billing/subscriptions.ts.- Customer payment logic in /packages/billing/appointments.ts.#

#When Stuck- Check /docs/ folder for detailed specs on each module.- Check existing types in /packages/shared/types before creating new ones.- If a Supabase query seems wrong, check the RLS policies in /packages/db/rls-policies.sql.- Do not install new npm packages without checking if functionality exists in current deps first.


1.1 Phase-by-Phase Build Plan for Claude Code
Use these phases as work orders for Claude Code. Complete each phase, test it, then move to next.

Phase 1: Foundation (Weeks 1-2)
Claude Code Prompt for Phase 1
Read CLAUDE.md. Set up the monorepo with Turborepo. Create /apps/web (Next.js), /apps/mobile (Expo), /apps/admin (Next.js), /packages/api (Express), /packages/db, /packages/shared, /packages/ai. Configure TypeScript strict mode, ESLint, Prettier for all packages. Set up Supabase client in /packages/db with type generation. Create the initial database schema migration (001_initial_schema.sql) covering all tables defined in the blueprint: tenants, tenant_locations, staff, categories, services, service_extras, appointments, customers, customer_behavior_profiles, coupons, reviews, subscription_plans, ai_nudge_log. Apply RLS policies. Set up Vercel project structure. Create /packages/config/env.ts with Zod validation for all environment variables.


Phase 2: Auth + Tenant Onboarding (Weeks 3-4)
Claude Code Prompt for Phase 2
Build tenant registration flow in /apps/web. Use Supabase Auth for tenant accounts. Registration form captures: business name, category (from global taxonomy), location(s), contact info. On completion: (1) Create tenant record in Supabase, (2) Create Stripe customer, (3) Redirect to Stripe Checkout for plan selection. Build Stripe subscription webhook handler. On subscription.created: activate tenant in Supabase. Build tenant login, forgot password. Build customer auth in /apps/mobile using Supabase Auth with magic link + phone OTP options. Implement RLS policies so tenants only see their own data.


Phase 3: Tenant Panel Core (Weeks 5-7)
Claude Code Prompt for Phase 3
Build the tenant management panel in /apps/web. Required screens: (1) Dashboard with appointment counts, revenue this week/month, upcoming appointments. (2) Services page — CRUD for services with multi-level category picker, duration, price, extras, deposit settings (toggle, type, amount). (3) Staff page — CRUD for staff, assign services, set availability schedule with breaks and days off. (4) Locations page — manage multiple locations with address (Google Maps autocomplete) and lat/lng. (5) Appointments page — calendar view (daily/weekly/monthly) plus list view with filtering. Allow status changes. (6) Customers page — list with search, click into customer detail with booking history and notes. (7) Settings — business info, notification templates, booking rules (advance window, cancellation policy), Stripe Connect onboarding button.


Phase 4: AI Chatbot (Weeks 8-10)
Claude Code Prompt for Phase 4
Build the AI chatbot in /packages/ai. Create tool definitions (TypeScript) for all 11 tools defined in Section 5.1 of the blueprint. Each tool has a corresponding API endpoint in /packages/api. Build the system prompt template in system-prompt.ts — it accepts customer context object and returns the full system prompt string. Build the chat streaming endpoint in /apps/api/routes/chat.ts using the Anthropic SDK with streaming. Build the chat UI in /apps/mobile: full-screen chat interface, streaming message display, inline buttons for confirmations (Yes/No), payment card entry UI (Stripe Payment Sheet), and booking confirmation cards. Implement the search_services tool first with PostGIS distance queries (enable PostGIS extension in Supabase). Test the full booking flow end-to-end: discovery → availability → book → payment.


Phase 5: Payments (Week 11)
Claude Code Prompt for Phase 5
Implement the complete Stripe payment flow for customer appointments. In /packages/billing/appointments.ts: function createBookingPaymentIntent(appointmentId, customerId, isDepositOnly). Handle Stripe Connect transfer_data for tenant payouts. Handle deposit-only payments where deposit_amount < total_price. Store payment_intent_id and deposit_paid status in appointments table. Process balance_due separately. Build Stripe webhook handler for payment_intent.succeeded and payment_intent.payment_failed. On success: mark appointment confirmed, trigger confirmation email (Resend) and SMS (Twilio). On failure: release the time slot (set appointment status back to 'available'). Test with Stripe test cards including deposit scenarios.


Phase 6: AI Memory & Notifications (Weeks 12-13)
Claude Code Prompt for Phase 6
Build the AI memory trigger system. In /packages/ai/memory-engine.ts: implement updateBehaviorProfile(customerId, tenantId, serviceId, bookingDate) — called after every successful booking. Calculates avg_interval_days as rolling average of gaps between bookings. Implement predictNextDate(profile) to compute predicted_next_date. Build three Vercel cron job handlers in /apps/api/routes/cron/: (1) duration-trigger.ts — runs daily, queries customers where predicted_next_date <= tomorrow, checks tenant availability via get_availability logic, sends Expo push notification if slot found. (2) location-trigger.ts — called by mobile app when GPS updates, checks proximity to customer's frequently-visited tenants (<500m), queries slots in next 30min. (3) promo-trigger.ts — called when tenant activates a coupon, queries customer_behavior_profiles for eligible customers, sends push. Implement Expo push notification sending in /packages/notifications/push.ts. Test all three trigger types.


Phase 7: Polish & Launch (Week 14)
Claude Code Prompt for Phase 7
Run full end-to-end test of all flows. Fix all TypeScript errors (zero tolerance). Write integration tests for all API routes. Write Playwright E2E tests for: tenant registration + plan selection, tenant adding a service with deposit, customer booking via chatbot with deposit payment, AI duration trigger sending notification. Set up Vercel production environment variables. Configure EAS Build for production iOS and Android builds. Set up error monitoring (add Sentry SDK to all apps). Review all Supabase RLS policies — verify tenants cannot access other tenants' data. Load test the chat endpoint with 50 concurrent users. Document all environment variables in /docs/ENV.md. Create /docs/DEPLOYMENT.md with step-by-step deploy instructions.


1.2 How to Use Claude Cowork as Office Manager
Claude Cowork is best used for planning, review, and coordination — not coding. Here's how to use it effectively:

Task Type: Sprint Planning
Cowork Prompt Template: "Review Phase 3 of the Balkina AI blueprint. Break it into daily tasks for a developer. Prioritize and flag any dependencies or risks."

Task Type: PR Review
Cowork Prompt Template: "Here is a GitHub PR diff for the deposit payment feature. Review against the blueprint requirements in Section 3.1. Flag any gaps or bugs."

Task Type: Bug Triage
Cowork Prompt Template: "Customer reported: chatbot shows wrong price when deposit is enabled. Walk me through debugging steps and which files to check in our codebase structure."

Task Type: API Design
Cowork Prompt Template: "Design the REST API endpoints for the tenant coupon management module. Include request/response schemas matching our Zod validation pattern."

Task Type: Decision Making
Cowork Prompt Template: "Should we build the Google Calendar sync in Phase 1 or defer to P2? Consider impact on MVP timeline vs. tenant acquisition."

Task Type: Writing Specs
Cowork Prompt Template: "Write a detailed technical spec for the waiting list feature that Claude Code can implement. Include DB changes, API endpoints, and notification logic."



2. MVP Definition — What to Launch First
P0 features (from Section 2) constitute the MVP. Everything else is post-launch. The MVP validates: can customers find and book via AI chatbot, do tenants get value from the panel, does the payment flow work.

MVP Launch Checklist
PLATFORM: 
• Tenant registration + Stripe subscription
• Global category taxonomy seeded
• Admin can view all tenants and appointments

TENANT PANEL: 
• Service + staff management
• Multi-location support
• Schedule management
• Appointment calendar
• Deposit payment configuration
• Customer CRM
• Email + SMS notifications via Resend + Twilio

CUSTOMER APP: 
• AI chatbot with full booking flow
• Geo-search (Google Maps)
• Stripe payment (full or deposit) in chat
• Booking confirmation (email + SMS)
• View/cancel/reschedule bookings
• Duration-based AI memory trigger
• User auth + profile


3. Critical Risks & Mitigation

Risk: AI chatbot misunderstands booking intent
Impact: Wrong booking made, bad customer experience
Mitigation: Always confirm with exact details before executing tool. Show confirmation card. One-click cancel within 5 min.

Risk: Location trigger drains battery
Impact: Users disable location sharing, feature unusable
Mitigation: Use significant-location-change mode (Expo) not continuous GPS. Batch updates. Make it clearly opt-in with value explanation.

Risk: Stripe Connect onboarding friction
Impact: Tenants give up before completing payout setup
Mitigation: Allow tenants to take bookings before Connect setup. Defer Connect to first payout request. Clear step-by-step UI.

Risk: RLS policy gap exposes tenant data
Impact: Major security incident, loss of trust
Mitigation: Write RLS tests. Claude Code must run a dedicated security test suite before any deploy. Penetration test before launch.

Risk: Claude API latency in chat
Impact: Sluggish chatbot UX, users abandon
Mitigation: Stream responses (never wait for full response). Show typing indicator immediately. Cache common search results.

Risk: Deposit disputes / chargebacks
Impact: Financial loss, Stripe account risk
Mitigation: Clear deposit policy shown before booking. Email receipt immediately. Explicit no-refund window in ToS.





Balkina AI — Master Product Blueprint v1.0 | Confidential
