# Port spec: Admin → Prospects growth engine → the creator product

Status: ready to execute · Date: 2026-10-29 · Source of truth: Balkina AI repo (`tseggai/balkinaAI`), feature "Admin → Prospects" (Migrations 068–070, `apps/admin/src/lib/growth/*`, `apps/marketing/src/app/claim/*`).

This document is written **for a Claude Code session running inside the creator product's repository**. That session cannot see the Balkina code, so everything it needs to rebuild the feature is spelled out here: schema, algorithms, API contracts, UI structure, copy, and the acceptance checklist. Where the creator product differs from Balkina, the adaptation is decided here, not left open.

Two adaptations are mandatory and are threaded through every section:

1. **Discovery source.** Balkina finds local service businesses on Google Places and reaches them on Instagram/WhatsApp. The creator product's customers are **content creators: primarily Bitcoin creators, then other crypto creators, then people/businesses who accept Bitcoin as payment**. They are not found on Instagram or Google Places. They are found on YouTube, podcasts, Nostr, X, newsletters, and Bitcoin-merchant directories. The prospector is therefore a **set of pluggable source adapters** instead of one Places client.
2. **Pre-provisioned page.** Balkina pre-builds an "unclaimed" booking page and the prospect claims it. The creator product must pre-build an **unclaimed creator page that is the product's real creator page** (same route, same component, same data model), hidden from discovery until claimed. The claim page's "test it" demo must simulate the creator page's **primary fan action**, not a booking.

---

## Part A — How to use this document

1. Read `CLAUDE.md` in the target repo first. It overrides this spec on stack conventions, naming, commit rules, and on **which media the creators are found on** if it names specific sources. This spec supplies defaults where `CLAUDE.md` is silent.
2. Do **Part C (Discovery)** completely before writing any code. Produce the "Resolved names" table in your first message, then build. Do not ask the user to confirm it unless a hard gate in Part C fires.
3. Build in the order of **Part D**. Each step ends with a build that passes and a commit. Do not reorder; later steps depend on earlier contracts.
4. Everything here that says **MUST** is a contract. Everything that says **default** is a choice you may change only if `CLAUDE.md` or the codebase gives a concrete reason, and you say so in the commit message.
5. Do not invent entities. Reuse the product's creator profile, auth, dashboard, public site, admin app, and LLM client. The only new tables are the `growth_*` tables in Part D.1–D.3 plus the columns added to the creator profile table in D.2.

---

## Part B — Audit of the Balkina implementation (what you are porting)

### B.1 The funnel in one paragraph

An admin picks a market (countries → cities → business types) in a modal. The server upserts **search targets** (one row per vertical × city), then the browser runs the **prospector** over those targets in chunks of two (Google Places Text Search, up to 60 results per query) and upserts **prospects** (one row per business, deduped on the Places id) with an **ICP score** computed from public facts. The browser then runs the **enricher** over the new rows in chunks of 16: it fetches the website and its contact page, extracts emails/phones/socials/booking-widget signals deterministically, optionally asks GPT-4o-mini for services/prices/hours/owner, writes `enrichment` jsonb, creates a **contact** row, adjusts the score, and moves stage `new → enriched`. From the list, the admin selects rows and clicks **Build booking pages**: the **pre-provisioner** creates an "unclaimed" tenant (status `unclaimed`, no user) with a category link, a location, an owner staff record, and services (extracted or vertical defaults with hidden prices), and issues a 30-day **claim token**. The admin then sends outreach by hand from a **CRM drawer** (templated first touch / follow-up / last chance, per channel, with a short channel-tagged claim link); every send is logged as a `sent` event and schedules the next follow-up. The prospect opens the **claim page** (public site), sees their business, runs a **simulated booking demo**, and **activates** with one email (passwordless; a single-use sign-in link drops them into the dashboard). Every claim-page interaction is posted as an event; a **DB trigger** folds events into counters and forward-only stage moves on the prospect, so the admin list shows live engagement and a "Due today" follow-up queue.

### B.2 Data model (Migrations 068, 069, 070)

| Table | Role | Notes |
|---|---|---|
| `growth_search_targets` | the search matrix | `segment`, `vertical`, `query`, `city`, `country`, `language`, `enabled`, `priority`, `last_run_at`, `last_results`, `total_found`. Unique `(segment, vertical, city, country)`. |
| `growth_prospects` | one row per business | identity + public facts (Places fields), `source`, `search_target_id`, `icp_score`, `stage`, `enrichment` jsonb, `notes`, `tenant_id`; claim columns (069): `claim_token` unique, `preprovisioned_at`, `claim_expires_at`, `claimed_at`, `claim_email`; CRM columns (070): `next_follow_up_at`, `last_activity_at`, `last_activity_type`, `touches`, `page_views`, `page_viewed_at`, `page_seconds`, `demo_completed_at`. |
| `growth_contacts` | people at a prospect | `name`, `title`, `email`, `phone`, `linkedin_url`, `language`, `source`, `consent_basis` (default `legitimate_interest_b2b`), `verified_at`, `unsubscribed_at`, `bounced_at`. Unique on `lower(email)`. |
| `growth_events` | the single activity log | `prospect_id`, `contact_id`, `enrollment_id`, `type`, `channel`, `provider_id`, `payload` jsonb. Unique `(type, provider_id)` where provider_id not null. Trigger `growth_events_apply` (070). |
| `growth_sequences`, `growth_enrollments`, `growth_ad_metrics` | planned automation | **Created but unused** by any code path. Do not port in v1 (see B.7). |

All tables: RLS enabled, **no policies** (service-role only). Tenant status gained `'unclaimed'`; discovery, `/b/<slug>`, chat tools and the admin tenants list all filter it out.

Stages (ordered): `new → enriched → qualified → disqualified → preprovisioned → contacted → viewed → engaged → replied → claimed → signed_up → customer → lost`. `qualified`/`disqualified`/`signed_up`/`customer`/`lost` are hand-set only. Automated jobs never lower a stage.

### B.3 Prospector (`lib/growth/prospector.ts`, `places.ts`, `score.ts`)

- Loads up to `limit` enabled targets, least-recently-run first then by priority; optional `targetIds`, `segment`.
- Per target: Places API (New) Text Search with `textQuery = "<query> <city>"`, `languageCode`, `regionCode`, up to 3 pages × 20. On HTTP 403 falls back to the legacy Places API (Text Search + Place Details for website/phone, 5 parallel). Field mask limited to what is stored.
- Normalises to `PlaceResult { placeId, name, address, city, country, lat, lng, website, phone, rating, reviewCount, types, primaryType, businessStatus, mapsUrl }`.
- Existing prospects (by `google_place_id`): **refresh public facts only** (address, website, instagram, phone, rating, review count, business status) — never stage, notes, enrichment, tenant link. New ones: insert with `icp_score = scoreProspect(place, vertical)`; `instagram` parsed from the website URL when it is an instagram.com link.
- Score (Places facts only): `+1` vertical in tier 1–2; `+2` reviews ≥ 20 and rating ≥ 4.3 else `+1` reviews ≥ 5; `+1` phone; website: `−3` competitor host (fresha, booksy, treatwell, simplybook, calendly, setmore, zakazi), `+2` instagram/facebook as website ("books by DM"), `+1` own site; `−5` not OPERATIONAL.
- Updates the target's `last_run_at`, `last_results`, `total_found += inserts`.
- Stops the whole run on a 403/429/500 from the provider (`stopped_reason`) because a key/billing problem fails every target identically.
- Result shape: `{ targets_run, places_found, inserted, updated, api_requests, api_used:{new,legacy}, errors:[{target,message}], stopped_reason }`.

### B.4 Enricher (`lib/growth/enricher.ts`)

- Selects up to `limit` prospects with `enriched_at IS NULL`, stage not in `(disqualified, lost)`, ordered by score desc then review count; or explicit `prospectIds` (used by "Re-enrich"); optional `targetIds`, `segment`. Concurrency 4 (max 8).
- `enrichProspect`: normalise website URL; skip with `skipped:'no_website'` or `skipped:'social_only'` (instagram/facebook/tiktok/linktr.ee/wa.me hosts; the handle is still captured). Fetch home (8 s timeout, 1.5 MB cap, HTML only, UA `…Bot/1.0; +https://<site>`), find a contact/services/prices page by link text regex, fetch it too. Extract: `<title>`, meta description, `<html lang>`, emails (regex, junk filter, ranked info@/kontakt@/office@ first, max 5), phones (`tel:` links + regex, 9–15 digits, max 5), socials (instagram, facebook, whatsapp, tiktok, linkedin/company), booking widget (competitor host list + own product), `text_chars`. Then optional LLM (`gpt-4o-mini`, temperature 0, `response_format: json_object`, ≤ 12k chars of text) → `owner_name, services[≤25]{name,price,currency,duration_minutes}, hours{day:"HH:MM-HH:MM"}, languages[], summary`. "Never invent data" in the system prompt.
- Writes `enrichment`, `enriched_at`; fills `email`/`instagram`/`phone` on the prospect **only if empty**; stage `new → enriched`; score delta `+1` emails, `+2` ≥ 3 services, `−3` competitor widget, `−1` fetch failed; creates one `growth_contacts` row for the first email (skips if that email already exists anywhere).
- Result shape: `{ processed, enriched, skipped, emails_found, contacts_created, llm_used, errors[] }` plus `llm_configured` from the route.

### B.5 Pre-provisioner (`lib/growth/preprovision.ts`)

- Idempotent per prospect: if `tenant_id` is set, only refresh the claim token when missing or expired-and-unclaimed; return `created:false`.
- Otherwise: look up the category by the vertical's `category_slug`; build a short slug from `cleanBusinessName(name)` (strips keyword stuffing like "… barber shop man salon by Volkan …" to "Friends Barber Shop"), make it unique with random hex suffixes; insert tenant `{ status:'unclaimed', user_id:null, name, owner_name (LLM owner or name), email, phone, category_id, business_type, currency, slug, description: summary }`; category link; location (coordinates from Places, country timezone/currency); owner staff (no user, `availability_schedule` from parsed enrichment hours when ≥ 3 valid days else Mon–Sat 09–17); services: extracted (≤ 12, duration from extraction or vertical default, `hide_price` when no price) else the vertical's default services in the country's language; link services to the location and the staff. Token = 24 random bytes hex (48 chars), expiry 30 days; prospect stage → `preprovisioned` if it was new/enriched/qualified; event `page_built`.
- Result: `{ prospect_id, tenant_id, claim_token, claim_url, services, created }`; runner wraps as `{ processed, created, existing, errors[], results[] }`.

### B.6 Admin surface (`apps/admin`)

Routes, all `requireAdmin()` (Supabase session user with `app_metadata.role === 'platform_admin'`, then a service-role client), all bodies Zod-validated:

| Route | Body / query | Does |
|---|---|---|
| `POST /api/admin/growth/generate` | `{ segment?, cities:[{city,country}] (1–40), verticals:[key] (1–30) }` | Upserts targets for the cross product (max 60), returns `{ targets:[{id,vertical,city,country,query}] }`. |
| `POST /api/admin/growth/prospector` | `{ limit≤100, target_ids?, max_pages 1–3, segment? }` | Runs the prospector. `maxDuration = 300`. |
| `POST /api/admin/growth/enricher` | `{ limit, prospect_ids?, search_target_ids?, segment? }` | Runs the enricher. |
| `POST /api/admin/growth/preprovision` | `{ prospect_ids?, limit, min_score?, segment? }` | Builds pages for ids, or the next N enriched/qualified by score. |
| `GET /api/admin/growth/prospects` | `segment, stage, vertical, country, city, min_score, q, has_email, built, enriched, due_before, activity (viewed|tested|untouched), sort (score|activity|due), page` | 50 per page, `{ data, count, page, page_size }`. `q` is stripped of `,()` before the PostgREST `or(ilike)` filter. |
| `PATCH /api/admin/growth/prospects` | `{ id, stage?, notes?, email?, instagram?, phone?, icp_score?, next_follow_up_at? }` | Hand edits. |
| `DELETE /api/admin/growth/prospects?id=` | | Deletes (cascades events/contacts; tenant link set null). |
| `GET /api/admin/growth/prospects/facets` | | Loads **every** row's facet columns into memory and counts: stages, countries, cities per country, verticals, segments, totals `{withEmail, enriched, pagesBuilt, claimed, contacted, highScore, viewed, tested, due}`. |
| `GET/POST /api/admin/growth/prospects/[id]/activity` | POST `{ type: sent|replied|note|call, channel?, text?, step?, lang?, next_follow_up_at? }` | Timeline (newest 200) / log a manual touch (`payload.by = admin email`), optionally set follow-up, returns the refreshed prospect row. |
| `GET/POST/PATCH/DELETE /api/admin/growth/targets`, `PATCH …/targets/bulk` | | Target CRUD and bulk enable/disable (AND-combined filters). No UI uses them today; the generate modal is the only target writer. |
| `GET /api/admin/growth/stats` | | Funnel counts. Unused by the current UI (the Growth page redirects to Prospects). |
| `POST/GET /api/growth/cron/prospect`, `…/cron/enrich` | `Authorization: Bearer <GROWTH_CRON_SECRET or CRON_SECRET>` | Unattended runs (limit 20 / 40). Vercel crons at 04:00 / 05:00 UTC. |

UI (`/dashboard/prospects`, sidebar item "Prospects"; `/dashboard/growth` redirects there):

- **Header**: title, one-line description, "+ Generate prospects" button. Empty state explains the flow and offers the same button.
- **Generate modal** (4 sections): countries (chips) → cities (chips per country, "all/none", add custom city) → business types (chips, presets "beauty & barbers / beauty + wellness / everything / clear") → depth (top 20/40/60 per search, "Enrich automatically" checkbox). Cost preview: searches = cities × types, up to N businesses, approximate provider cost. Run phases with progress rows: preparing → searching (chunks of 2 targets) → enriching (rounds of 16 until `processed = 0`) → done/error. Stops on `stopped_reason`.
- **Funnel strip** (6 KPIs): Prospects (sub: high fit · enriched), Pages built, Contacted (% of pages), Viewed page (% of contacted), Tested booking (% of viewers), Claimed (% of contacted).
- **Stage tabs**: All, ⏰ Due today (follow-up queue, amber when > 0), then each stage with a count (hidden when 0 unless selected).
- **Filters**: country, city (scoped to country), business type, min score (2/4/6), email any/yes/no, page any/built/not, activity any/untouched/viewed/tested, free-text search (name/site/IG), sort (score / last activity / follow-up due; forced to due on the Due tab).
- **Bulk bar** (when rows selected): Enrich, Build booking pages, Set stage…, Delete, clear.
- **Rows** (desktop table / mobile cards): checkbox, score badge (green ≥ 4, amber ≥ 2), name + address + chips (`Instagram only`, `No website`, `Site unreachable`, `N services · M emails`, `uses <Competitor>`, `Page ready`, `Claimed`), type, city/country, provider rating + map link, contact lines (site, @ig, phone, email), stage select (coloured), activity cell (last action · relative time, `N sent · M views · time`, due chip), actions (WhatsApp / IG follow-up quick-send when a page is ready; build page; enrich; open).
- **Drawer** (right, 680 px, prev/next with arrow keys, Esc closes): header = name, Enrich/Re-enrich, place · rating · type · map, score, due chip, claimed chip; contact row with channel icons (wa.me, ig.me/m, mailto, site) and **Edit** (phone/IG/email + Delete); booking-page row (short claim link, copy, valid-until / claimed-by, or **Build booking page**); tabs **Overview** (4 stats: Sent, Page views, Time on page, Tested booking; Notes; **Messages** composer; **Follow-up** + "They got back to us"; **What we know** enrichment card) and **Activity** (filter all/theirs/ours, add note, timeline with dots: emerald = claimed, brand = their action, grey = ours).
- **Messages composer**: step select (First touch / Follow-up / Last chance; default from `touches`), channel toggle (WhatsApp / Instagram / Email / Copy; default = first channel with a contact), language toggle, stage select; textarea pre-filled from the template (edits persist until Reset); one action button: "Send on WhatsApp" (opens `wa.me/<digits>?text=`), "Copy & open Instagram" (clipboard + `ig.me/m/<handle>`), "Copy & open email" (`mailto:`), "Copy & log". Every send logs `sent` with `{channel, step, lang, text}` and sets `next_follow_up_at` (+2 days after first, +3 after follow-up, none after last chance). Disabled until the page is built ("every message needs the claim link").
- **Quick send** from the row does the same with the defaults, no composer.

Outreach copy (`lib/growth/outreach.ts`), same voice as the claim page, link alone on its own line:

- first: "Hi {First}, {Biz} is now bookable instantly, 24/7. Test it, love it, and activate it for free.\n{link}"
- follow_up: "Hi {First}, did you get a chance to try the booking page for {Biz}? It takes 20 seconds, and activating is free.\n{link}"
- last_chance: "Hi {First}, the page for {Biz} is reserved until {date}. After that we take it down. Activating is free and takes 10 seconds.\n{link}"

Short link: `https://<site>/c/<first 12 hex of token>?c=wa|ig|em|ot`; the site resolves the prefix (must match exactly one row) and 302s to `/claim/<token>?c=…`.

### B.7 Public claim funnel (`apps/marketing`)

- `GET /claim/[token]` (server component, `force-dynamic`, Supabase client with `cache:'no-store'`): validates `^[a-f0-9]{48}$`, loads prospect + tenant + services + location; states `invalid` / `claimed` / `expired` / `ready`. `generateMetadata` sets title "{Biz} — your booking page is ready", `robots: noindex`, OG/Twitter; `opengraph-image.tsx` (edge) renders a 1200×630 brand card with the business name.
- `ClaimPage` (client): language toggle (local-first, EN second; persisted in localStorage), optional WhatsApp-support button; sections: **the business** (clean name, full name as secondary, address, rating stars + review count) → **what we did** ("{First},\n{Biz} is now bookable instantly, 24/7. Test it, love it, and activate it for free.") → **two CTAs** ("Test by booking your services / Book now" and "Claim your page — free / Activate now") → "Offer expires on {date}". Tracks `claim_page_view` (with lang, mobile, channel) and `claim_page_leave` (visible seconds via visibilitychange/pagehide, sendBeacon).
- `ClaimDemo` (bottom sheet, 4 steps + confirmation, **nothing is written**): choose service → pick day (next 7, Sundays closed) → pick time (09–17, 30-min grid, deterministic "taken" slots) → details (name/phone, defaults "Ana", "+382 67 123 456") → confirmation showing "what the customer sees" (confirmed card) and "what your business sees" (a push-notification mock + the appointment card with Approve/Move/Message) → "Claim my business". Fires `claim_demo_opened` / `claim_demo_completed`.
- `ClaimForm` (sheet): email only (pre-filled; "Signing you in as X (change)"), "Activate my page", disclosure "+ Set name and password now". `POST /api/claim { token, email, owner_name?, password? }` → creates the auth user (`email_confirm:true`), links tenant (`user_id`, `email`, `owner_name`, `status:'active'`), links owner staff (`user_id` where null), prospect `{ claimed_at, claim_email, stage:'claimed' }`, event `claimed`, mints a magic-link `hashed_token` → `login_url = <app>/auth/callback?token_hash=…&type=magiclink&next=/dashboard`, sends a best-effort welcome email (Resend) whose button hits `GET /api/claim/login?token=` to mint a fresh link. Returns `{ login_url, booking_url, business_name }`. Errors: 404 invalid, 409 already claimed / tenant not unclaimed / email already registered, 410 expired.
- `ClaimShare`: ✓ "Your page is live", the booking URL (selectable), View / Share (native share sheet on phones; copy + WhatsApp on desktop), "Open my dashboard" (POST `/api/claim/login` for a fresh single-use link, falls back to the one from the claim). Events: `claim_share_view/copy/whatsapp/native`, `claim_dashboard_opened`.
- `POST /api/claim/event { token, type, payload? }`: 12 allowed types; `claim_page_view` deduped per prospect per hour; stores `ua`.
- `POST|GET /api/claim/login`: mints a magic link for 24 h after claiming, only when `tenant.email === prospect.claim_email`.
- `apps/web/auth/callback` consumes `token_hash` + `type=magiclink` via `supabase.auth.verifyOtp`.

### B.8 CRM trigger (Migration 070) — the exact semantics to reproduce

On every `growth_events` insert with a `prospect_id`:

- `last_activity_at/type` ← event time/type, **except** `claim_page_leave` and `note` (they never count as activity).
- `page_views += 1` and `page_viewed_at` first-set on `claim_page_view`.
- `page_seconds += clamp(payload.seconds, 0, 3600)` on `claim_page_leave`.
- `demo_completed_at` first-set on `claim_demo_completed`.
- `last_contacted_at` ← time and `touches += 1` on `sent`.
- Stage (forward only): `claimed` → `claimed`; `replied` → `replied` from preprovisioned/contacted/viewed/engaged; `claim_demo_completed | claim_activate_opened | claim_clicked` → `engaged` from preprovisioned/contacted/viewed; `claim_page_view` → `viewed` from preprovisioned/contacted; `sent` → `contacted` from new/enriched/qualified/preprovisioned.
- Backfill query recomputes the counters from existing events.

### B.9 Known weaknesses found in the audit (fix these in the port; do not copy them)

1. **Re-enrich double-counts the score.** The enricher's one-time score delta is only guarded by `enriched_at IS NULL` in the default query; the `prospectIds` path (the drawer's "Re-enrich" button) bypasses it, so every re-enrich adds the delta again. **Port fix:** make `icp_score` a pure function `score(prospectFacts, enrichment)` recomputed on every prospector and enricher write; keep a `score_override INTEGER NULL` column for hand edits instead of patching the computed value.
2. **Facets route scans the whole table in app memory.** Fine below ~50k rows, wrong beyond. **Port fix:** a `security definer` SQL function `growth_prospect_facets(segment text)` returning the same JSON via `GROUP BY`, called with `.rpc()`.
3. **Orphan auth user on claim failure.** `/api/claim` creates the auth user before updating the profile; if the profile update fails the user exists with nothing attached. **Port fix:** on any failure after `createUser`, call `auth.admin.deleteUser(userId)` before returning the error.
4. **Existing account cannot claim.** An email that already has a login gets a 409. Acceptable for v1; log it as an event `claim_blocked_existing_user` so it is visible in the timeline (Balkina does not).
5. **Two env vars for one value** (`GROWTH_CLAIM_BASE_URL` server-side, `NEXT_PUBLIC_CLAIM_BASE_URL` client-side). **Port:** one `NEXT_PUBLIC_CLAIM_BASE_URL` read in both places.
6. **Name helpers duplicated** because the public site does not depend on the shared package. If the target repo's public site can import the shared package, keep one copy.
7. **Dead schema** (`growth_sequences`, `growth_enrollments`, `growth_ad_metrics`). Do not create them. Keep `growth_events.enrollment_id` out as well; add it when a sequence runner exists.
8. **`stats` and `targets` routes have no UI.** Port `generate` + `targets/bulk` + `GET targets` only; skip `stats`.
9. **Plan/implementation drift**: the GTM plan describes a `growth_preprovisioned` table; the implementation put the claim columns on `growth_prospects`. Follow the implementation.
10. **Unclaimed visibility is enforced by convention** (every discovery query adds `status = 'active'`). The port MUST enumerate every public read path of the creator profile (Part C.4) and gate each one, plus gate any money movement.

---

## Part C — Discovery in the target repo (do this first, then write the table)

Read `CLAUDE.md`, the package/app layout, the creator profile schema, the public creator page, the auth flow, the admin app, and the LLM client. Resolve every row below. Where the codebase has no answer, use the default in the right column. Only the rows marked **GATE** may stop you to ask the user.

| Key | What to find | Default if absent |
|---|---|---|
| `ADMIN_APP` | The admin/back-office Next.js app (or admin section) and how admin auth is checked (`requireAdmin` equivalent). **GATE** if there is no admin surface at all. | — |
| `PUBLIC_SITE` | The app that serves public creator pages and marketing pages (where `/claim/[token]` and `/c/[code]` will live). | the same app as the creator pages |
| `DASHBOARD_APP` | The creator's logged-in dashboard app and its auth callback route (must accept `token_hash` + `type=magiclink`, add it if missing, mirroring B.7). | — |
| `SHARED_PKG` | The shared types/constants package importable by admin + public site. | create `packages/shared` equivalents inside each app if none |
| `DB` | Supabase project, migrations folder, naming scheme (sequential number prefix), how RLS is written. **GATE** if the product is not on Supabase/Postgres. | — |
| `CREATOR_TABLE` | The table that is one row per creator (e.g. `creators`, `profiles`). Its primary key, `user_id`/auth link column, `slug`/handle column, `status`/visibility column, display name, bio, avatar column, and payment columns (Lightning address, wallet, etc.). | — |
| `CREATOR_PAGE_ROUTE` | The public route that renders a creator (e.g. `/[handle]`, `/c/[slug]`) and the component tree it uses. | — |
| `PRIMARY_FAN_ACTION` | What a fan does on the creator page: tip/zap in sats, subscribe to a tier, buy a product, book, send a message. The demo in D.11 simulates **this**. If several, pick the one the page's main CTA points to. | tip in sats |
| `OFFERING_TABLE` | The entity a creator page lists (tiers, products, offers, services, links). Needed so the pre-provisioner can seed it. May be none (page is profile + links only). | none → seed only profile + links |
| `LINKS_MODEL` | Where a creator's external links live (columns or a `creator_links` table). | columns `youtube_url`, `x_url`, `nostr_npub`, `website_url` on the creator table (add them in D.2 only if nothing exists) |
| `DISCOVERY_PATHS` | Every query that lists or searches creators publicly: directory/explore pages, search API, sitemap, OG/feeds, "featured" widgets, admin creator lists, payout jobs, email digests. List each file. | — |
| `PAYMENT_PATHS` | Every server path that moves money to a creator (Lightning invoice creation, LNURL-pay, Stripe, on-chain). Each must refuse when the creator is unclaimed. | — |
| `LLM_CLIENT` | The product's existing LLM call helper and provider (Anthropic or OpenAI), its env var. Use it for the enricher's extraction; do not add a second SDK. | REST call to the provider named in `CLAUDE.md` |
| `EMAIL` | Transactional email provider + from address (welcome email after claim). | skip the welcome email if none |
| `BRAND` | Product name, public domain, dashboard domain, primary colour token, logo asset path, support contact (email or Telegram/Nostr) for the claim page. | — |
| `SOURCES` | Whether `CLAUDE.md` names the media/platforms where creators are found, or competitor platforms. If it does, they override D.5's default source list and competitor list. | D.5 defaults |
| `LANGS` | Product languages. | EN only (drop the SR/EN toggle; keep the i18n table shape so a second language is one object away) |

Write the resolved table as the first section of your plan. Then build.

---

## Part D — Build plan (in order; each step builds green and commits)

Naming below uses the Balkina names (`growth_*`, "prospect", "claim"). Keep them unless `CLAUDE.md` has a naming rule; they are already generic.

### D.1 Migration A — growth tables

Create `<next number>_growth.sql` with exactly these tables. Differences from Balkina are the creator identity columns and the target matrix shape.

```sql
-- Growth engine: prospect lists, contacts and events for creator outreach.
-- Service-role only: written by the admin app and crons; no anon/authenticated policies.

CREATE TABLE IF NOT EXISTS growth_search_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL DEFAULT 'creator' CHECK (segment IN ('creator', 'merchant')),
  niche TEXT NOT NULL,                 -- bitcoin, lightning, nostr, crypto, defi, btc_merchant, ... (catalogue key)
  platform TEXT NOT NULL,              -- youtube, podcast, nostr, btcmap, x, csv
  query TEXT NOT NULL,                 -- search text for that platform
  language TEXT NOT NULL DEFAULT 'en', -- ISO 639-1
  region TEXT,                         -- ISO 3166-1 alpha-2 lower case, or null for global
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 5, -- 1 = run first
  last_run_at TIMESTAMPTZ,
  last_results INTEGER,
  total_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (segment, niche, platform, query, language, region)
);
ALTER TABLE growth_search_targets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS growth_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL DEFAULT 'creator' CHECK (segment IN ('creator', 'merchant')),
  niche TEXT,
  name TEXT NOT NULL,                  -- display name as shown on the platform
  handle TEXT,                         -- primary handle without @
  platform TEXT NOT NULL,              -- platform the row was found on
  external_id TEXT NOT NULL,           -- platform-native id (UC… channel id, npub, feed url hash, btcmap id, x user id)
  profile_url TEXT,
  avatar_url TEXT,                     -- hotlinked platform avatar; never re-hosted before claim
  bio TEXT,
  language TEXT,
  country TEXT,
  city TEXT,
  followers INTEGER,                   -- subscribers / followers / listeners (platform-specific, best available)
  content_count INTEGER,               -- videos / episodes / notes
  views_total BIGINT,
  last_published_at TIMESTAMPTZ,
  website TEXT,
  email TEXT,
  x_handle TEXT,
  youtube_channel_id TEXT,
  nostr_pubkey TEXT,                   -- hex
  nostr_nip05 TEXT,
  podcast_feed_url TEXT,
  telegram TEXT,
  lightning_address TEXT,              -- user@domain (lud16) when found
  accepts_bitcoin BOOLEAN NOT NULL DEFAULT false,
  external_ids JSONB NOT NULL DEFAULT '{}'::jsonb, -- { youtube: 'UC…', nostr: 'npub…', x: '123', podcast: 'https://…' } for cross-source dedupe
  source TEXT NOT NULL,                -- adapter key that created the row
  search_target_id UUID REFERENCES growth_search_targets(id) ON DELETE SET NULL,
  icp_score INTEGER NOT NULL DEFAULT 0,
  score_override INTEGER,              -- hand-set; wins over the computed score when not null
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN (
    'new', 'enriched', 'qualified', 'disqualified', 'preprovisioned',
    'contacted', 'viewed', 'engaged', 'replied', 'claimed', 'signed_up', 'customer', 'lost'
  )),
  enrichment JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  creator_id UUID REFERENCES <CREATOR_TABLE>(id) ON DELETE SET NULL, -- set when pre-provisioned / claimed
  enriched_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_segment_stage ON growth_prospects (segment, stage);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_score ON growth_prospects (icp_score DESC);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_niche ON growth_prospects (niche);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_platform ON growth_prospects (platform);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_creator ON growth_prospects (creator_id);
CREATE INDEX IF NOT EXISTS idx_growth_prospects_external_ids ON growth_prospects USING gin (external_ids);
ALTER TABLE growth_prospects ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS growth_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES growth_prospects(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  email TEXT,
  x_handle TEXT,
  nostr_pubkey TEXT,
  telegram TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  source TEXT,                         -- website, youtube_about, rss, nostr_profile, manual
  consent_basis TEXT NOT NULL DEFAULT 'legitimate_interest_b2b',
  verified_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_growth_contacts_prospect ON growth_contacts (prospect_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_contacts_email ON growth_contacts (lower(email)) WHERE email IS NOT NULL;
ALTER TABLE growth_contacts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS growth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES growth_prospects(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES growth_contacts(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  channel TEXT,                        -- email, x, nostr, youtube, telegram, web, other
  provider_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_growth_events_prospect_time ON growth_events (prospect_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_events_provider ON growth_events (type, provider_id) WHERE provider_id IS NOT NULL;
ALTER TABLE growth_events ENABLE ROW LEVEL SECURITY;
```

Seed targets in the same migration (guarded by `WHERE NOT EXISTS (SELECT 1 FROM growth_search_targets)`): the cross product of the niche catalogue's default queries × platforms from D.4, `language='en'`, `region` null. Do not seed `x` targets (paid API) or `csv`.

### D.2 Migration B — unclaimed creators and claim tokens

```sql
-- Pre-provisioned ("unclaimed") creator pages and claim tokens.
-- Adapt the status constraint to the creator table's real status/visibility column.
ALTER TABLE <CREATOR_TABLE> DROP CONSTRAINT IF EXISTS <CREATOR_TABLE>_status_check;
ALTER TABLE <CREATOR_TABLE> ADD CONSTRAINT <CREATOR_TABLE>_status_check
  CHECK (status IN (<existing values…>, 'unclaimed'));
-- If the creator table has no status column, add: status TEXT NOT NULL DEFAULT 'active' with that check,
-- and backfill nothing (existing rows are active).
-- If user_id is NOT NULL today, relax it: ALTER TABLE <CREATOR_TABLE> ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE growth_prospects
  ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS preprovisioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_email TEXT;
```

If `LINKS_MODEL` resolved to "nothing exists", also add nullable link columns to the creator table here (`youtube_url`, `x_url`, `nostr_npub`, `podcast_url`, `website_url`). Do not add columns the page cannot render.

**RLS gate (MUST):** every existing public `SELECT` policy on `<CREATOR_TABLE>` (and on `<OFFERING_TABLE>`, links, and any view) must exclude unclaimed rows, e.g. `USING (status = 'active')` or by adding `AND status <> 'unclaimed'`. The claim page reads with the service role, so it is unaffected. Then go through `DISCOVERY_PATHS` and `PAYMENT_PATHS` from Part C and add the same filter in application code where the query already runs with a service role (admin lists, crons, sitemaps, payouts, invoice creation). Grep the repo for every `.from('<CREATOR_TABLE>')` and for the table name in SQL functions; list them in the commit message with "gated" or "n/a" next to each.

### D.3 Migration C — CRM columns and trigger

```sql
ALTER TABLE growth_prospects
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_type TEXT,
  ADD COLUMN IF NOT EXISTS touches INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_views INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS page_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demo_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_growth_prospects_follow_up ON growth_prospects (next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_growth_prospects_activity ON growth_prospects (last_activity_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION growth_events_apply() RETURNS TRIGGER AS $$
DECLARE
  secs INTEGER := 0;
BEGIN
  IF NEW.prospect_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.type = 'claim_page_leave' THEN
    secs := LEAST(GREATEST(COALESCE((NEW.payload->>'seconds')::numeric, 0)::integer, 0), 3600);
  END IF;

  UPDATE growth_prospects SET
    last_activity_at = CASE WHEN NEW.type IN ('claim_page_leave', 'note') THEN last_activity_at ELSE GREATEST(COALESCE(last_activity_at, NEW.created_at), NEW.created_at) END,
    last_activity_type = CASE WHEN NEW.type IN ('claim_page_leave', 'note') THEN last_activity_type ELSE NEW.type END,
    page_views = page_views + CASE WHEN NEW.type = 'claim_page_view' THEN 1 ELSE 0 END,
    page_viewed_at = CASE WHEN NEW.type = 'claim_page_view' THEN COALESCE(page_viewed_at, NEW.created_at) ELSE page_viewed_at END,
    page_seconds = page_seconds + secs,
    demo_completed_at = CASE WHEN NEW.type = 'claim_demo_completed' THEN COALESCE(demo_completed_at, NEW.created_at) ELSE demo_completed_at END,
    last_contacted_at = CASE WHEN NEW.type = 'sent' THEN NEW.created_at ELSE last_contacted_at END,
    touches = touches + CASE WHEN NEW.type = 'sent' THEN 1 ELSE 0 END,
    stage = CASE
      WHEN NEW.type = 'claimed' THEN 'claimed'
      WHEN NEW.type = 'replied' AND stage IN ('preprovisioned', 'contacted', 'viewed', 'engaged') THEN 'replied'
      WHEN NEW.type IN ('claim_demo_completed', 'claim_activate_opened', 'claim_clicked') AND stage IN ('preprovisioned', 'contacted', 'viewed') THEN 'engaged'
      WHEN NEW.type = 'claim_page_view' AND stage IN ('preprovisioned', 'contacted') THEN 'viewed'
      WHEN NEW.type = 'sent' AND stage IN ('new', 'enriched', 'qualified', 'preprovisioned') THEN 'contacted'
      ELSE stage
    END,
    updated_at = now()
  WHERE id = NEW.prospect_id;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_growth_events_apply ON growth_events;
CREATE TRIGGER trg_growth_events_apply AFTER INSERT ON growth_events
  FOR EACH ROW EXECUTE FUNCTION growth_events_apply();

-- Facets in SQL (replaces Balkina's in-memory scan; see B.9.2)
CREATE OR REPLACE FUNCTION growth_prospect_facets(p_segment TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH rows AS (
    SELECT * FROM growth_prospects WHERE p_segment IS NULL OR segment = p_segment
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM rows),
    'stages', (SELECT coalesce(jsonb_object_agg(stage, n), '{}') FROM (SELECT stage, count(*) n FROM rows GROUP BY stage) s),
    'niches', (SELECT coalesce(jsonb_object_agg(coalesce(niche,'unknown'), n), '{}') FROM (SELECT niche, count(*) n FROM rows GROUP BY niche) s),
    'platforms', (SELECT coalesce(jsonb_object_agg(platform, n), '{}') FROM (SELECT platform, count(*) n FROM rows GROUP BY platform) s),
    'languages', (SELECT coalesce(jsonb_object_agg(coalesce(language,'unknown'), n), '{}') FROM (SELECT language, count(*) n FROM rows GROUP BY language) s),
    'countries', (SELECT coalesce(jsonb_object_agg(coalesce(country,'unknown'), n), '{}') FROM (SELECT country, count(*) n FROM rows GROUP BY country) s),
    'totals', jsonb_build_object(
      'withEmail', (SELECT count(*) FROM rows WHERE email IS NOT NULL),
      'enriched', (SELECT count(*) FROM rows WHERE enriched_at IS NOT NULL),
      'pagesBuilt', (SELECT count(*) FROM rows WHERE creator_id IS NOT NULL),
      'claimed', (SELECT count(*) FROM rows WHERE claimed_at IS NOT NULL),
      'contacted', (SELECT count(*) FROM rows WHERE last_contacted_at IS NOT NULL OR touches > 0),
      'highScore', (SELECT count(*) FROM rows WHERE coalesce(score_override, icp_score) >= 4),
      'viewed', (SELECT count(*) FROM rows WHERE page_viewed_at IS NOT NULL),
      'tested', (SELECT count(*) FROM rows WHERE demo_completed_at IS NOT NULL),
      'due', (SELECT count(*) FROM rows WHERE next_follow_up_at <= (date_trunc('day', now()) + interval '1 day' - interval '1 ms') AND claimed_at IS NULL)
    )
  );
$$;
REVOKE ALL ON FUNCTION growth_prospect_facets(TEXT) FROM public, anon, authenticated;
```

Apply the three migrations to the Supabase project the way `CLAUDE.md` prescribes (CLI or MCP `apply_migration`), then regenerate DB types if the repo does that.

### D.4 Shared types and catalogue

In `SHARED_PKG`:

**Types** (`types/growth.ts`): `GrowthSegment = 'creator' | 'merchant'`, `GrowthProspectStage` (13 values, same order as B.2) and `GROWTH_PROSPECT_STAGES` array, `GrowthSearchTarget`, `GrowthProspect` (every column of D.1–D.3), `GrowthContact`, `GrowthEvent`, `GrowthManualEventType = 'sent'|'replied'|'note'|'call'`, `GrowthOutreachChannel = 'email'|'x'|'nostr'|'youtube'|'telegram'|'other'`, and:

```ts
export interface GrowthEnrichment {
  fetched_at: string;
  fetched_url: string | null;          // website actually fetched, if any
  skipped?: 'no_website' | 'social_only';
  error?: 'fetch_failed';
  title?: string | null;
  description?: string | null;
  lang?: string | null;
  emails: string[];
  socials: { x?: string; youtube?: string; nostr?: string; nip05?: string; telegram?: string; github?: string; substack?: string; instagram?: string; linkedin?: string };
  lightning_address?: string | null;   // verified via /.well-known/lnurlp/<user> when possible
  lightning_verified?: boolean;
  monetization: string[];              // detected hosts: patreon, buymeacoffee, geyser, fountain, substack, gumroad, ko-fi, …
  competitor: string | null;           // first competitor platform detected (from COMPETITOR_HOSTS)
  text_chars?: number;
  llm_model?: string;
  person_name?: string | null;         // the human behind the channel, if public
  topics?: string[];                   // ≤ 8 short topic labels
  offerings: { name: string; kind?: 'membership' | 'course' | 'consulting' | 'product' | 'newsletter' | 'other'; price?: number | null; currency?: string | null }[];
  cadence?: string | null;             // "weekly video", "daily notes"
  audience_geo?: string | null;
  languages?: string[];
  summary?: string | null;             // one sentence, English
  recent_titles?: string[];            // ≤ 10 latest content titles (from platform API / RSS)
}
```

**Constants** (`constants/growth.ts`):

```ts
export type GrowthPlatform = 'youtube' | 'podcast' | 'nostr' | 'btcmap' | 'x' | 'csv';
export const GROWTH_PLATFORMS: { key: GrowthPlatform; label: string; needsEnv: string | null; costNote: string }[] = [
  { key: 'youtube', label: 'YouTube', needsEnv: 'YOUTUBE_API_KEY', costNote: '100 quota units per search page; 10k units/day free' },
  { key: 'podcast', label: 'Podcasts', needsEnv: null, costNote: 'free (Apple Search API + RSS); Podcast Index optional' },
  { key: 'nostr', label: 'Nostr', needsEnv: null, costNote: 'free (relay search)' },
  { key: 'btcmap', label: 'Bitcoin merchants (BTC Map)', needsEnv: null, costNote: 'free' },
  { key: 'x', label: 'X', needsEnv: 'X_BEARER_TOKEN', costNote: 'paid API tier required' },
  { key: 'csv', label: 'CSV import', needsEnv: null, costNote: 'manual' },
];

export interface GrowthNiche {
  key: string; label: string; tier: 1 | 2 | 3; segment: GrowthSegment;
  queries: Partial<Record<GrowthPlatform, string[]>>;   // default search strings per platform
  default_offerings: { name: string; kind: GrowthEnrichment['offerings'][number]['kind'] }[]; // seeded when enrichment found none
}
export const GROWTH_NICHES: GrowthNiche[] = [
  { key: 'bitcoin', label: 'Bitcoin', tier: 1, segment: 'creator',
    queries: { youtube: ['bitcoin podcast', 'bitcoin education', 'bitcoin news channel', 'bitcoin self custody'], podcast: ['bitcoin'], nostr: ['bitcoin', 'btc', 'sats', '21 million', 'plebs'] },
    default_offerings: [{ name: 'Support my work', kind: 'other' }, { name: 'Monthly supporter', kind: 'membership' }] },
  { key: 'lightning', label: 'Lightning / Nostr builders', tier: 1, segment: 'creator',
    queries: { youtube: ['lightning network tutorial', 'nostr tutorial'], podcast: ['lightning network', 'nostr'], nostr: ['lightning', 'zaps', 'nostr dev'] },
    default_offerings: [{ name: 'Support my work', kind: 'other' }] },
  { key: 'bitcoin_mining', label: 'Bitcoin mining', tier: 1, segment: 'creator',
    queries: { youtube: ['bitcoin mining channel', 'home mining'], podcast: ['bitcoin mining'] }, default_offerings: [{ name: 'Support my work', kind: 'other' }] },
  { key: 'austrian_econ', label: 'Sound money / macro', tier: 2, segment: 'creator',
    queries: { youtube: ['austrian economics', 'sound money podcast'], podcast: ['sound money'] }, default_offerings: [{ name: 'Support my work', kind: 'other' }] },
  { key: 'crypto', label: 'Crypto (general)', tier: 2, segment: 'creator',
    queries: { youtube: ['crypto news channel', 'altcoin analysis'], podcast: ['crypto'], nostr: ['crypto'] }, default_offerings: [{ name: 'Support my work', kind: 'other' }] },
  { key: 'defi', label: 'DeFi / Ethereum', tier: 2, segment: 'creator',
    queries: { youtube: ['defi tutorial', 'ethereum news'], podcast: ['defi', 'ethereum'] }, default_offerings: [{ name: 'Support my work', kind: 'other' }] },
  { key: 'privacy_tech', label: 'Privacy & open source', tier: 2, segment: 'creator',
    queries: { youtube: ['privacy tech channel', 'open source software review'], podcast: ['privacy', 'open source'], nostr: ['privacy', 'foss'] }, default_offerings: [{ name: 'Support my work', kind: 'other' }] },
  { key: 'btc_merchant', label: 'Accepts Bitcoin (merchants)', tier: 3, segment: 'merchant',
    queries: { btcmap: ['*'] }, default_offerings: [{ name: 'Pay with Bitcoin', kind: 'other' }] },
];
export const COMPETITOR_HOSTS: { host: string; name: string }[] = [ /* resolve from CLAUDE.md (SOURCES); defaults: */
  { host: 'patreon.com', name: 'Patreon' }, { host: 'buymeacoffee.com', name: 'Buy Me a Coffee' }, { host: 'ko-fi.com', name: 'Ko-fi' },
  { host: 'geyser.fund', name: 'Geyser' }, { host: 'fountain.fm', name: 'Fountain' }, { host: 'substack.com', name: 'Substack' },
  { host: 'gumroad.com', name: 'Gumroad' }, { host: 'stacker.news', name: 'Stacker News' }, { host: 'zap.stream', name: 'zap.stream' },
];
export const FOLLOWER_SWEET_SPOT = { min: 1_000, max: 250_000 }; // too small = no revenue yet; too big = has a stack
export const ACTIVE_DAYS = 60;
export const INACTIVE_DAYS = 365;
export function getGrowthNiche(key: string | null | undefined): GrowthNiche | undefined { … }
export function getGrowthPlatform(key: string | null | undefined) { … }
```

If `CLAUDE.md`'s `SOURCES` section names platforms, niches, or competitors, replace these defaults with them; keep the shapes.

### D.5 Source adapters (`<ADMIN_APP>/src/lib/growth/sources/`)

One file per platform, each exporting `search(target, opts): Promise<SearchResult>` with:

```ts
export interface CreatorResult {
  platform: GrowthPlatform; externalId: string; name: string; handle: string | null; profileUrl: string | null; avatarUrl: string | null;
  bio: string | null; language: string | null; country: string | null; city: string | null;
  followers: number | null; contentCount: number | null; viewsTotal: number | null; lastPublishedAt: string | null;
  website: string | null; email: string | null; xHandle: string | null; youtubeChannelId: string | null; nostrPubkey: string | null; nostrNip05: string | null;
  podcastFeedUrl: string | null; telegram: string | null; lightningAddress: string | null; acceptsBitcoin: boolean;
  externalIds: Record<string, string>; recentTitles?: string[]; raw?: unknown;
}
export interface SearchResult { results: CreatorResult[]; requests: number; quotaUsed?: number; }
export class SourceError extends Error { constructor(message: string, public readonly status: number, public readonly fatal: boolean) { super(message); } }
```

`fatal:true` means "every target on this platform will fail the same way" (bad key, quota exhausted, 403/429); the runner stops that platform's targets for the run.

**`youtube.ts`** (YouTube Data API v3, `YOUTUBE_API_KEY`):
- `search.list?part=snippet&type=channel&q=<query>&maxResults=50&relevanceLanguage=<language>&regionCode=<region?>&pageToken=` (100 units per page; `maxPages` default 2).
- Then `channels.list?part=snippet,statistics,brandingSettings,contentDetails&id=<up to 50 ids>` (1 unit) → `title`, `description` → bio, `customUrl` → handle (strip `@`), `thumbnails.high.url` → avatar, `country`, `defaultLanguage`, `subscriberCount` (null when `hiddenSubscriberCount`), `videoCount`, `viewCount`, `brandingSettings.channel.unsubscribedTrailer` ignored.
- `lastPublishedAt`: `playlistItems.list?playlistId=<contentDetails.relatedPlaylists.uploads>&maxResults=5` (1 unit) → latest `publishedAt`, and `recentTitles`. Skip when `videoCount = 0`.
- Links: parse the description for URLs; set `website` to the first non-social URL; `xHandle`/`nostrNip05`/`telegram`/`lightningAddress` by regex (`npub1[0-9a-z]{58}`, `[\w.+-]+@[\w.-]+\.\w+` that is not an email on a known mail host is a candidate Lightning address; verify later in the enricher).
- `externalId = channelId`, `profileUrl = https://www.youtube.com/channel/<id>` (or `/@handle`), `externalIds = { youtube: id }`.
- Quota guard: stop the run with `fatal:true` on 403 `quotaExceeded`; expose `quotaUsed` (100 per search page + 1 per list call) in the result so the modal can show it.

**`podcast.ts`** (no key):
- Apple Search: `https://itunes.apple.com/search?media=podcast&entity=podcast&term=<query>&limit=200&lang=en_us&country=<region ?? 'US'>` → `collectionId`, `collectionName`, `artistName`, `feedUrl`, `artworkUrl600`, `trackCount`, `releaseDate`, `genres`, `primaryGenreName`, `country`.
- For each feed (concurrency 5, 8 s timeout, 2 MB cap): parse RSS with a regex/light XML approach (no new dependency unless one exists): `itunes:owner/itunes:email` → email, `itunes:author`, `link` → website, `language`, `lastBuildDate`/first `item/pubDate` → lastPublishedAt, 10 latest `item/title` → recentTitles, `podcast:value` block with `type="lightning"` → `acceptsBitcoin = true` and the recipient `address` → `lightningAddress` (keysend node id goes to `externalIds.lightning_node`), `podcast:funding` URL → monetization hint (stored in `raw`).
- Optional Podcast Index (`PODCASTINDEX_KEY` + `PODCASTINDEX_SECRET`, SHA-1 auth header): `GET /api/1.0/search/byterm?q=` gives `value` blocks and `itunesId` directly; use it when configured, else Apple + RSS.
- `externalId = feedUrl normalised` (lowercase host, strip query/trailing slash), `externalIds = { podcast: feedUrl, itunes: collectionId }`, `platform='podcast'`, `followers = null` (no public listener count), `contentCount = trackCount`.

**`nostr.ts`** (no key; WebSocket from the server, Node 18+ `ws` or the global `WebSocket` if the runtime has it — check what the repo already uses; if neither, do a REST fallback through `https://api.nostr.band/v0/search?q=<query>&kind=0` and treat it as best-effort):
- NIP-50 search: connect to `wss://relay.nostr.band` (fallback `wss://search.nos.today`), send `["REQ", id, {"kinds":[0], "search": "<query>", "limit": 100}]`, collect until `EOSE` or 10 s.
- Kind 0 `content` JSON → `name`/`display_name` → name, `about` → bio, `picture` → avatar, `website`, `nip05` → `nostrNip05`, `lud16` → `lightningAddress` + `acceptsBitcoin = true`, `lud06` ignored. `externalId = pubkey hex`, `handle = nip05 ?? name`, `profileUrl = https://njump.me/<npub>` (encode bech32 npub; implement the small bech32 encoder inline, no dependency).
- Followers: `GET https://api.nostr.band/v0/stats/profile/<pubkey>` → `followers_pubkey_count`, `pub_note_count` → contentCount, best-effort (5 s timeout, ignore failures).
- Only keep profiles whose `about` or `name` matches the target query terms case-insensitively (relay search is loose), and drop obvious bots (no `about`, no `picture`, zero notes).

**`btcmap.ts`** (no key; segment `merchant`):
- `GET https://api.btcmap.org/v2/elements?updated_since=<ISO, 2 years ago>` once per run (cache in module memory for the run; it is large), filter `osm_json.tags` where `deleted_at` is null and (`payment:bitcoin=yes` or `payment:lightning=yes` or `currency:XBT=yes`), and `addr:country`/`addr:city` match the target `region`/`query` (`query='*'` = any city in the region).
- Map: `name`, `website`, `contact:email` → email, `contact:twitter` → xHandle, `contact:telegram`, `addr:city`, `addr:country`, lat/lon kept in `raw`; `acceptsBitcoin = true`; `externalId = element id`; `platform='btcmap'`; `followers = null`.
- Merchant rows are tier 3 and render the same in the admin; their claim page copy uses the merchant variant (D.11).

**`x.ts`** (optional, `X_BEARER_TOKEN`): `GET /2/users/search?query=&max_results=100&user.fields=description,location,public_metrics,url,profile_image_url,verified_type,entities` (available only on paid tiers). Map `public_metrics.followers_count`, `tweet_count`, `url`/`entities.url` → website, `description` → bio, Lightning address and npub regex on the bio. `externalId = user id`. If the env var is absent, the adapter throws `SourceError('X API not configured', 501, true)` and the modal hides the platform.

**`csv.ts`**: `POST /api/admin/growth/import` with a CSV (`platform,handle_or_url,niche,name?,email?,notes?`) parsed server-side; each row is resolved through the matching adapter's `lookup(handleOrUrl)` (implement `lookup` for youtube by handle/URL via `channels.list?forHandle=`, nostr by npub/nip05, podcast by feed URL, x by username) and inserted with `source='csv'`. Errors returned per row.

**Cross-source dedupe (MUST):** before inserting, look up existing prospects by `(platform, external_id)` **and** by any shared id in `external_ids` (`external_ids ?| array[...]` on the known keys: a YouTube channel found via a podcast's RSS link, an npub found in a YouTube description). When a match exists, merge: fill empty identity columns, union `external_ids`, refresh public facts (followers, content_count, views_total, last_published_at, avatar_url, bio, website), **never** touch `stage`, `notes`, `enrichment`, `creator_id`, `claim_*`, `score_override`.

### D.6 Scoring (`lib/growth/score.ts`) — pure function, recomputed on every write

```ts
export function scoreProspect(p: ScoreFacts, e: GrowthEnrichment | null): number {
  let s = 0;
  const niche = getGrowthNiche(p.niche);
  if (niche?.tier === 1) s += 2; else if (niche?.tier === 2) s += 1;
  if (p.lightning_address || e?.lightning_address || p.accepts_bitcoin) s += 2;      // already earns in sats
  if (e?.lightning_verified) s += 1;
  if (p.followers != null) {
    if (p.followers >= FOLLOWER_SWEET_SPOT.min && p.followers <= FOLLOWER_SWEET_SPOT.max) s += 1;
    else if (p.followers > FOLLOWER_SWEET_SPOT.max) s -= 1;
  }
  if (p.last_published_at && daysSince(p.last_published_at) <= ACTIVE_DAYS) s += 1;
  if (p.last_published_at && daysSince(p.last_published_at) > INACTIVE_DAYS) s -= 5;
  if (p.email || e?.emails?.length) s += 1;
  if (p.website) s += 1;
  if (p.nostr_pubkey) s += 1;                                                       // reachable without a gatekeeper
  if ((e?.offerings?.length ?? 0) >= 1) s += 1;                                     // already sells something
  if (e?.competitor) s -= 3;                                                        // on a competitor today (still contact later with a switch offer)
  if (e?.error === 'fetch_failed') s -= 1;
  return Math.max(-10, Math.min(20, s));
}
```

Display score = `score_override ?? icp_score`. "High fit" = `>= 4`.

### D.7 Prospector runner (`lib/growth/prospector.ts`)

Same contract as B.3 with these substitutions: targets keyed by `(segment, niche, platform, query, language, region)`; `searchPlaces` → `sources[target.platform].search(target, { maxPages })`; dedupe per D.5; insert `icp_score = scoreProspect(row, null)`; result shape `{ targets_run, found, inserted, updated, merged, requests, quota: { youtube: number }, errors:[{target,message}], stopped: Record<GrowthPlatform, string> }` (a fatal `SourceError` stops only that platform; other platforms' targets continue — this differs from Balkina on purpose because one failing provider must not block the free ones).

### D.8 Enricher (`lib/growth/enricher.ts`)

Keep B.4's structure (selection, concurrency, timeouts, HTML-to-text, link extraction, email ranking, junk filters, LLM call with strict JSON and "never invent") with these changes:

- **Inputs per platform**: website fetch as in Balkina (home + a `about|contact|links|support|sponsor|work-with-me` page). Additionally, when the website is a link hub (linktr.ee, linkin.bio, bio.link, beacons.ai, stan.store, carrd.co), fetch it and extract its outbound links (these are the creator's real destinations); do not mark it `social_only`. For YouTube rows, append the channel description and `recent_titles` to the LLM text. For podcasts, append the RSS `description` and `recent_titles`. For Nostr, append `about`.
- **Extract**: emails (same ranking, but prefer `business|press|booking|collab|sponsor|hello|contact` locals), socials (x.com/twitter.com, youtube.com/@ or /channel/, `npub1…`, `nip05` `name@domain` only when the page says nostr/npub near it, t.me, github.com, substack.com, instagram.com, linkedin.com/in), `lightning_address` (candidate `user@domain` found near the words "lightning", "lnurl", "zap", "sats", "⚡" or as `lightning:`/`lnurlp://` links), **verify it** with `GET https://<domain>/.well-known/lnurlp/<user>` (5 s timeout; JSON with `callback` → `lightning_verified = true`), `monetization` hosts (patreon, buymeacoffee, ko-fi, geyser, fountain, substack, gumroad, stan.store, zap.stream, stacker.news, opennode, btcpay, strike.me, coinos, alby, walletofsatoshi, getalby), `competitor` = first match from `COMPETITOR_HOSTS`.
- **LLM** (via `LLM_CLIENT`; model from env `GROWTH_LLM_MODEL`, default the product's cheapest model; temperature 0; JSON): system prompt "You extract structured facts about an independent content creator from their public pages. Return strict JSON with keys person_name (string|null), topics (≤ 8 short labels), offerings (array of {name, kind ∈ membership|course|consulting|product|newsletter|other, price number|null, currency ISO|null}, max 15, only what the text actually sells), cadence (string|null), audience_geo (string|null), languages (ISO 639-1 array), summary (one sentence, English, third person). Never invent data." User text ≤ 12k chars, prefixed with name, platform, niche, followers.
- **Writes**: `enrichment`, `enriched_at`; fill `email`, `x_handle`, `nostr_pubkey`, `nostr_nip05`, `telegram`, `website`, `lightning_address` on the prospect only when empty; `accepts_bitcoin = true` when a Lightning address was found; stage `new → enriched`; `icp_score = scoreProspect(row, enrichment)` (recomputed, not delta'd); one `growth_contacts` row for the first email (name = `person_name`, title = 'Creator' or 'Owner' for merchants, `source`).
- Result shape as B.4.

### D.9 Pre-provisioner (`lib/growth/preprovision.ts`) — builds the real creator page

Contract (MUST): the row it creates is a normal `<CREATOR_TABLE>` row rendered by `CREATOR_PAGE_ROUTE` with **no special-case component**; the only differences are `status='unclaimed'`, `user_id=null`, and the gates from D.2.

- Idempotent per prospect as in B.5 (`creator_id` set → refresh token only; `created:false`).
- Slug/handle: `toSlug(cleanCreatorName(name))` where `cleanCreatorName` strips trailing descriptors (`podcast`, `channel`, `official`, `tv`, `show`, `news`, `crypto`, `bitcoin` only when not the whole name, emoji, `| …` suffixes) and caps at 4 words; prefer the platform handle when it is clean `[a-z0-9_]{3,30}`; unique with hex suffixes; respect the product's handle rules (reserved words, length) by calling the product's own slug validator if one exists.
- Creator row: display name = cleaned name; bio = `enrichment.summary ?? prospect.bio (first 300 chars)`; avatar = **hotlinked `avatar_url`** stored in whatever column the page reads, with a flag or naming convention that the dashboard can later replace on upload (do not download/re-host platform avatars before claim); links from the prospect (`youtube_url`, `x_url`, `nostr_npub`, `podcast_url`, `website_url`) into `LINKS_MODEL`; `lightning_address` **only** into a column the product treats as "unverified / display only" — never into a column that payment code uses to route money (if the product has one column for both, leave it null and store the address in `growth_prospects` only); language; country; `status='unclaimed'`; `user_id=null`; any NOT NULL columns the product requires get the product's own defaults (look at the self-serve creator creation code path and reuse its helper if one exists — do not duplicate its defaults by hand).
- Offerings (when `OFFERING_TABLE` exists): from `enrichment.offerings` (≤ 8; price kept when numeric, else hidden/0 with the product's "hide price" equivalent) else the niche's `default_offerings`. Mark them the way the product marks drafts if it has such a flag.
- Token 48 hex, 30 days; prospect `creator_id`, `preprovisioned_at`, `claim_expires_at`, stage → `preprovisioned` when from new/enriched/qualified; event `page_built { creator_id, offerings }`.
- `claimUrlFor(token) = ${NEXT_PUBLIC_CLAIM_BASE_URL}/claim/${token}`.

### D.10 Admin API + UI (`ADMIN_APP`)

Implement every route in B.6 with the following renames and no others: `vertical` → `niche`; `country/city` filters stay, add `platform` and `language` filters; `instagram` → `x_handle` in PATCH (also allow `nostr_pubkey`, `telegram`, `lightning_address`, `website`); facets via `rpc('growth_prospect_facets')`; `generate` body `{ segment?, niches:[key] (1–30), platforms:[key] (1–6), languages:[iso] (1–5), regions?:[cc] }` producing targets for niche × platform × language (× region) using the niche's default queries (max 60 combos), skipping platforms whose `needsEnv` is unset (return them in `skipped_platforms`); `prospector` body `{ limit, target_ids?, max_pages 1–3, segment? }`; add `POST /api/admin/growth/import` (D.5 csv); keep `preprovision`, `enricher`, `prospects`, `activity`, `targets` (GET + bulk PATCH). Crons: `POST|GET /api/growth/cron/prospect` and `/enrich` with `GROWTH_CRON_SECRET` (accept `CRON_SECRET` too); register in `vercel.json` if the admin deploys on Vercel; `maxDuration = 300` on the long routes.

UI: rebuild B.6's page, modal, rows, drawer, and CRM one-to-one with these content changes:

- Page title "Prospects", description "Creators we found, what we know about them, and where each one is in the funnel."
- Generate modal sections: **1. Niches** (chips from `GROWTH_NICHES`, presets "Bitcoin only / Bitcoin + crypto / everything / clear"), **2. Platforms** (chips from `GROWTH_PLATFORMS`; disabled with a tooltip when `needsEnv` is unset; `csv` opens the import panel instead), **3. Languages** (chips; default `en`) and optional regions (for YouTube `regionCode` and BTC Map country), **4. Depth** (pages 1–3 → "Top 50/100/150 per search" for YouTube; shows "YouTube quota: ~N units of 10,000/day"), "Enrich automatically" checkbox. Progress rows: Preparing → Searching {platform list} (`found · new · merged · requests`) → Enriching → Done.
- Funnel strip labels: Prospects (high fit · enriched), Pages built, Contacted, Viewed page, Tested {PRIMARY_FAN_ACTION verb} (e.g. "Tested tipping"), Claimed.
- Row columns: Score · Creator (name, @handle, platform icon, chips: `Lightning ⚡` when `accepts_bitcoin`, `N offerings · M emails`, `uses <Competitor>`, `No website`, `Site unreachable`, `Page ready`, `Claimed`) · Niche · Platform · Reach (followers formatted `12.3k`, content count, "active 12d ago") · Contact (site, @x, npub short, email, t.me) · Stage · Activity · actions (quick-send **Email** when email exists, else **X DM** when `x_handle`, else **Nostr DM** when `nostr_pubkey`; build page; enrich; open).
- Drawer header line: `{platform} · {followers} followers · {niche} · profile link`; contact row icons for email (`mailto:`), X (`https://x.com/messages/compose?recipient_id=<id>` when the X user id is known, else `https://x.com/<handle>`), Nostr (`nostr:<npub>` link, which opens the user's Nostr client, plus a copy-npub button), YouTube (profile URL), Telegram (`https://t.me/<handle>`), site. Edit form fields: email, X handle, npub, Telegram, Lightning address, website. "What we know" card shows: person, topics, offerings, monetization, competitor, Lightning (verified ✓ / unverified), languages, summary, recent titles.
- Messages composer channels: **Email** (copy & open `mailto:` with subject + body), **X** (copy & open DM/profile), **Nostr** (copy & open `nostr:` link), **YouTube** (copy; the admin pastes into the channel's business email or a comment), **Telegram** (copy & open), **Copy**. Default channel = first with a contact in that order. Language toggle only if `LANGS` has more than one.
- Demo stat label: "Tested {PRIMARY_FAN_ACTION}".

Outreach copy (`lib/growth/outreach.ts`), same structure as B.6 (step × channel × lang, follow-up 2/3/none days, short link with `?c=em|x|ns|yt|tg|ot`), creator voice, email gets a subject line:

- first (email subject): "{Name}, your {BRAND} page is ready"
- first: "Hi {First}, we set up a {BRAND} page for {Name} so your audience can {PRIMARY_FAN_ACTION, e.g. 'send you sats'} in one tap, no middleman and no fees held back. Have a look, try it, and claim it for free if you like it.\n{link}"
- follow_up: "Hi {First}, did you get a chance to look at the {BRAND} page we built for {Name}? Trying it takes 20 seconds, and claiming is free.\n{link}"
- last_chance: "Hi {First}, the page for {Name} is reserved until {date}. After that we take it down. Claiming is free and takes 10 seconds.\n{link}"
- merchant variant (segment `merchant`): replace the fan action with "let customers {pay you in Bitcoin / tip in sats}" per `PRIMARY_FAN_ACTION`.

Replace the product name, action verb and any value proposition with what `CLAUDE.md` says the product does; keep the length and shape (greeting, one sentence of value, one sentence of ask, link alone on its own line).

### D.11 Public claim funnel (`PUBLIC_SITE`)

Port B.7 one-to-one with these adaptations:

- `/claim/[token]` loads prospect + creator row + offerings + links with the service role (`cache:'no-store'`); states invalid / claimed / expired / ready; metadata title "{Name} — your {BRAND} page is ready", `noindex`; OG image = brand card with the creator's name (and the hotlinked avatar if the OG runtime can fetch it; otherwise name only).
- **Section 1, the creator**: render the **real creator page component** (`CREATOR_PAGE_ROUTE`'s component) in a preview wrapper: a thin top banner "Preview · nothing is live yet", pointer-events disabled on real money actions, the page's own avatar/name/bio/links/offerings exactly as a fan would see them after claiming. If the component cannot be reused without side effects (data fetching hooks that hit RLS-gated tables), extract its presentational part into a component that takes props, use that in both places, and leave the route's behaviour unchanged.
- **Section 2, what we did**: "{First},\nwe set up {Name} on {BRAND} so your audience can {PRIMARY_FAN_ACTION} in one tap. Test it, like it, and claim it for free."
- **Section 3, two CTAs**: "Try it as a fan / {action verb}" and "Claim your page — free / Activate now". Then "Offer expires on {date}".
- **Demo sheet** (`ClaimDemo`): a no-write simulation of `PRIMARY_FAN_ACTION`. Default (tip in sats): step 1 pick an amount (chips 1,000 / 5,000 / 21,000 sats + custom) and an optional message; step 2 "Pay" shows a **fake invoice screen** (QR placeholder with a visible "DEMO" watermark, never a real invoice) and a "Simulate payment" button; step 3 confirmation: "what the fan sees" (✓ "Sent 5,000 sats to {Name}") and "what you see" (a notification mock "⚡ New tip · 5,000 sats · 'Love the show'" and the dashboard row with the running total), disclaimer "This is a demo · nothing was sent", **Claim my page**, **Try again**. For subscribe/buy/book actions mirror the product's real flow in 3–4 steps the same way. Events `claim_demo_opened` / `claim_demo_completed`.
- **Activate sheet** (`ClaimForm`): email only (pre-filled from the prospect's email), "+ Set name and password now" disclosure, terms line. `POST /api/claim { token, email, owner_name?, password? }` → validate token/expiry/unclaimed; create auth user (`email_confirm:true`, `user_metadata.full_name`); on any later failure `deleteUser`; link creator row (`user_id`, `email`, `status:'active'`, display name if the owner typed one); prospect `{ claimed_at, claim_email, stage:'claimed' }`; event `claimed`; magic link `hashed_token` → `login_url = ${DASHBOARD_APP}/auth/callback?token_hash=…&type=magiclink&next=<dashboard home>`; best-effort welcome email through `EMAIL` with a button to `GET /api/claim/login?token=`; return `{ login_url, page_url, name }`. Error codes as B.7; existing-email case logs `claim_blocked_existing_user`.
- **Share screen**: ✓ "Your page is live", the page URL, View / Share (native share; copy + X intent `https://x.com/intent/post?text=` + Nostr "copy note text" on desktop), "Open my dashboard" (POST `/api/claim/login` first). Hint line: "Put this link in your YouTube description, X bio and Nostr profile."
- `POST /api/claim/event`: the 12 types from B.7 (rename `claim_share_whatsapp` → `claim_share_x`, add `claim_share_nostr`), hourly dedupe of `claim_page_view`, `ua` stored.
- `POST|GET /api/claim/login`: 24 h window, `creator.email === prospect.claim_email`.
- `GET /c/[code]`: prefix lookup, exactly-one match, 302 with `?c=`.
- `DASHBOARD_APP` auth callback: add the `token_hash` + `type=magiclink|recovery|email` branch (B.7) if missing.
- Tracking helper (`trackClaim`) with `sendBeacon`, never throws.

### D.12 Crons and env

| Var | App | Purpose |
|---|---|---|
| `YOUTUBE_API_KEY` | admin | YouTube Data API v3 (enable the API on the key's project). |
| `PODCASTINDEX_KEY`, `PODCASTINDEX_SECRET` | admin | optional, better podcast data. |
| `X_BEARER_TOKEN` | admin | optional, paid. |
| `GROWTH_CRON_SECRET` | admin | bearer for `/api/growth/cron/*` (also accepts `CRON_SECRET`). |
| `GROWTH_LLM_MODEL` | admin | optional model override for the enricher. |
| `NEXT_PUBLIC_CLAIM_BASE_URL` | admin + public site | base for claim links (default = the public site's origin). |
| `NEXT_PUBLIC_APP_URL` | public site | dashboard origin for `login_url`. |
| `NEXT_PUBLIC_SUPPORT_CONTACT` | public site | optional support link on the claim page (Telegram/Nostr/email), hidden when unset. |
| `SUPABASE_SERVICE_ROLE_KEY` | admin + public site | already present; the claim routes use it server-side only. |

Crons: prospector daily (limit 20, pages 2), enricher daily one hour later (limit 40). Document them in `docs/growth/ROUTINES.md` (create it) with the same table shape as B.6's cron rows and a one-paragraph prompt per routine (call the endpoint once, report the counters, stop on `stopped`).

### D.13 Documentation and CLAUDE.md

Add a "Growth Engine" section to the target repo's `CLAUDE.md` in the same style as the rest of that file: tables, admin route, adapters and their env vars, the unclaimed-status rule and the list of gated paths, the claim funnel, the CRM trigger, and the "never lower a stage from an automated job" rule. Add `docs/growth/ROUTINES.md`.

---

## Part E — Acceptance checklist (run every line before the final commit)

Build and types:
- [ ] The repo's full build command passes with zero errors and zero new warnings; `tsc --noEmit` passes in every touched package.
- [ ] Lint passes.

Data:
- [ ] Migrations apply cleanly on a fresh branch database and are idempotent (apply twice).
- [ ] Inserting a `growth_events` row of each type in B.8 updates the prospect exactly as specified (write a SQL script that inserts one of each and asserts the counters/stage; keep it under `scripts/` or the repo's test folder).
- [ ] `growth_prospect_facets()` returns the same numbers as a manual `GROUP BY`.

Prospecting:
- [ ] Generate with niches `bitcoin` + platforms `youtube,podcast,nostr` inserts rows for all three platforms; re-running the same combo inserts 0 and reports merged/updated > 0.
- [ ] A YouTube channel whose description links an npub, later found on Nostr, is **one** prospect with both ids in `external_ids`.
- [ ] Revoking `YOUTUBE_API_KEY` makes the YouTube targets stop with `stopped.youtube` set while podcast and Nostr targets still complete.
- [ ] BTC Map with region `de` and query `*` produces merchant rows with `accepts_bitcoin = true`.

Enrichment:
- [ ] A link-hub website (linktr.ee) is followed to its outbound links and is not marked `social_only`.
- [ ] A Lightning address on a site with a valid `/.well-known/lnurlp/` is stored with `lightning_verified = true`; an invalid one is stored unverified.
- [ ] Re-enrich on the same row leaves `icp_score` unchanged (pure recompute).
- [ ] Without the LLM env var the enricher still finds emails/socials and reports `llm_configured:false`.

Pages and gating:
- [ ] Build page creates a creator row that renders at `CREATOR_PAGE_ROUTE` **only** when fetched with the service role; the same URL as an anonymous visitor returns the product's not-found (or whatever the product shows for a hidden creator), and the creator does not appear in any directory, search, sitemap, feed, admin creator list, or payout job (walk the `DISCOVERY_PATHS` and `PAYMENT_PATHS` list from Part C and tick each).
- [ ] Every money path refuses an unclaimed creator with a clear server error.
- [ ] The build is idempotent: Build page twice → `created:1, existing:1`, one creator row.

Claim funnel:
- [ ] `/claim/<token>` renders the real creator page component in preview; the demo completes without any DB write (check `growth_events` only grew by the claim events).
- [ ] Activate with a fresh email → creator `status='active'`, `user_id` set, prospect `claimed`, event `claimed`, `login_url` signs the owner into the dashboard, welcome email sent (or skipped when `EMAIL` is absent, with a log line).
- [ ] Activate with an email that already has an account → 409 and event `claim_blocked_existing_user`; no orphan auth user.
- [ ] Expired token → 410 page; claimed token → "already claimed" page; garbage token → invalid page; `/c/<12 hex>?c=x` redirects to the full token with `?c=x`.
- [ ] A forced failure after `createUser` (e.g. temporarily break the creator update) leaves no auth user behind.

CRM:
- [ ] Quick-send Email from a row opens `mailto:` with the first-touch text, logs `sent`, stage → `contacted`, follow-up set 2 days out, row appears under "Due today" when the date is moved to today.
- [ ] Claim-page view from the token moves the stage to `viewed`; demo completion to `engaged`; "Replied via X" to `replied`.
- [ ] Drawer prev/next with arrow keys; Esc closes; mobile cards show the same actions.

Docs:
- [ ] `CLAUDE.md` section and `docs/growth/ROUTINES.md` written; commit messages follow the repo's convention.

---

## Part F — Scope boundaries

In scope: everything in Part D. Out of scope for this build (do not start them, do not leave stubs): automated sending (email/Nostr DM sequences), reply webhooks, ad metrics, a reporter, unclaimed-page cleanup job, Instagram/Canva anything. Mention them once in `ROUTINES.md` under "Still to build".

Legal/ethical rules carried over (MUST): only publicly listed facts; store `consent_basis` on contacts; no cold automated DMs (the admin sends by hand from the composer); unclaimed pages are unlisted, use hotlinked public avatars with attribution to the platform, never take real money, and are deleted 30 days after the claim link expires (manual for now); every outreach email identifies the sender and honours unsubscribe (log `unsubscribed_at` on the contact when the admin logs a reply that says so).
