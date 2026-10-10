# Balkina AI — Go-To-Market & Growth Automation Plan

Status: proposal · Date: 2026-10-10 · Owner: tseggai
Scope: marketing (where to advertise, which campaigns) and sales (prospect lists + outreach) for both products, with ~100% of the recurring work run by Claude.

Products covered:

| Product | Deck | Buyer | Price | Sales motion |
|---|---|---|---|---|
| Balkina for Business (tenant) | balkina.ai/tenant-deck | Owner of a salon, barbershop, spa, clinic, gym, studio, restaurant, café, tour operator | €5 / €19 / €49 / €99 per month, free to start | Self-serve, product-led. Volume. Ads + automated outreach. |
| Balkina White-Label (property) | balkina.ai/deck | GM / asset manager / resident-services head of a marina resort, mixed-use development, hotel, mall, food hall | €899 / €2,500 / €5,600 per month, custom above | Account-based. Low volume, high ticket. Named-account outreach + one human demo. |

---

## 1. Recommendation in one paragraph

Run the two products as two separate funnels on one shared "growth engine" that lives in this repo (Supabase tables + admin panel + Resend) and is operated by Claude Code Routines on a schedule. For the tenant product, lead with Meta (Instagram) and Google Search ads in Serbia, Montenegro and Croatia, and pair them with a done-for-you hook: Claude pre-builds the business's booking page from its Google listing and Instagram before we ever email them, so the outreach says "your page is ready, claim it". For the white-label product, build one named-account list of roughly 200 properties on the Adriatic, wider Balkans and the Gulf, run LinkedIn sponsored content and a four-touch email + LinkedIn sequence against it, and funnel every reply into a 20-minute human walkthrough booked through Balkina itself. Claude does list building, enrichment, personalisation, sending, reply triage, creative production, weekly ad optimisation and reporting. You keep three human jobs: approve the first week of every new sequence, run white-label demos, and set ad budgets.

---

## 2. Who we are selling to

### 2.1 Tenant ICP (volume funnel)

Assumption: first geography is Serbia + Montenegro + Croatia (the deck is EN/SR and the reference customer is on the Adriatic). Second wave: Bosnia, North Macedonia, Slovenia, Albania, then the Serbian/Croatian diaspora businesses in Vienna, Munich, Zurich.

Priority verticals, ranked by (a) booking pain, (b) Instagram presence, (c) willingness to pay €19–€49:

1. Hair salons, barbershops, nail studios, lash/brow studios (highest Instagram density, book by DM today)
2. Massage, spa, physiotherapy, cosmetic clinics, dentists (higher ticket, no-show pain, deposits)
3. Personal trainers, yoga/pilates studios, small gyms (recurring rebooking = Smart Rebooking feature)
4. Tour operators, boat charters, experiences on the coast (Bokun/Viator sync is a unique hook)
5. Restaurants and cafés with event nights (table requests + ticketed events)

Disqualifiers: chains already on an enterprise system, businesses with no phone/website/Instagram (unreachable), franchises with HQ-mandated tools.

### 2.2 White-label ICP (account-based funnel)

A property with 5–50 bookable businesses on site plus a resident or member community. Ranked by fit:

1. Marina resorts and branded residences on the Adriatic and Mediterranean (direct Portonovi analogues)
2. Mixed-use developments with residences + retail + F&B (Belgrade Waterfront type)
3. Ski resorts and mountain villages with multiple operators (Kopaonik, Jahorina, Bansko, Kolašin)
4. Hotel resorts with outsourced spa / restaurants / activities
5. Shopping centres and food halls with event programmes
6. Golf and country clubs, coworking campuses, gated communities (second wave)

Buyer titles: General Manager, Marina Manager, Director of Guest Experience, Head of Resident Services / Community, Asset Manager, Centre Manager, Marketing Director. Economic buyer is usually the GM or the developer's asset management lead.

---

## 3. The growth engine (what Claude runs)

Build it in the repo so every piece is inspectable, re-runnable and owned by us. No separate outbound SaaS is required at the start.

### 3.1 Data layer (new Supabase migration `068_growth.sql`)

| Table | Purpose |
|---|---|
| `growth_prospects` | One row per target business or property: name, segment (`tenant`/`property`), vertical, city, country, website, instagram, phone, google_place_id, rating, review_count, icp_score, stage, owner notes |
| `growth_contacts` | People at a prospect: name, title, email, linkedin_url, source, verified_at, consent_basis |
| `growth_sequences` | Sequence definitions: name, segment, steps (jsonb: day offset, channel, template id) |
| `growth_enrollments` | Prospect × sequence: current step, next_send_at, status (active/replied/bounced/unsubscribed/converted) |
| `growth_events` | Every send, open, click, reply, bounce, unsubscribe, claim, signup, demo booked (source: Resend webhooks, app events) |
| `growth_ad_metrics` | Daily spend, impressions, clicks, leads, signups per platform × campaign × ad set (pulled by a Routine) |
| `growth_preprovisioned` | Tenant-segment only: tenant_id created in "unclaimed" state, claim_token, claimed_at |

RLS: service-role only. Surfaced in `apps/admin` under a new **Growth** section (prospects table with filters, enrollment controls, a reply inbox, campaign metrics, and an approval queue).

### 3.2 Agents (Claude Code Routines, cron-triggered, each with a narrow prompt)

| Routine | Cadence | What it does | Human gate |
|---|---|---|---|
| Prospector (tenant) | Daily 06:00 | Runs Google Places Text Search for the vertical × city matrix ("frizerski salon Novi Sad", "barber Budva", "masaža Split"…), dedupes against `growth_prospects`, inserts new rows with place data, scores ICP | None |
| Prospector (property) | Weekly Mon | Searches marina directories, hotel-group portfolio pages, mall operator sites and LinkedIn company pages for new accounts matching the ICP; adds to the named-account list with a one-paragraph fit note | You approve new accounts weekly (5 min) |
| Enricher | Daily 07:00 | For each new prospect: fetch website + Instagram bio, extract services, prices, staff names, hours, owner name, email, WhatsApp; find emails via Hunter/Apollo API for properties; writes `growth_contacts` | None |
| Pre-provisioner (tenant) | Daily 08:00 | For prospects with ≥ 3 extracted services: creates an unclaimed tenant (hidden visibility, no payments) using `provisionTenantDefaults`, loads services/staff/hours, generates a claim link | None |
| Personaliser | Daily 09:00 | Writes the first-touch email per prospect in the prospect's language (SR/HR/ME/EN) from a template + the extracted facts; stores as the step-1 draft | First 7 days of any new sequence: you approve in the admin queue. After that: auto-send |
| Sender | Daily 10:00 and 15:00 local | Sends due steps via Resend from the outreach subdomain, respects daily caps and suppression list | None |
| Reply triage | Every hour | Reads inbound replies (Resend inbound → `growth_events`), classifies: interested / question / not now / unsubscribe / out-of-office / bounce. Interested → sends booking link for a walkthrough (tenant) or alerts you + proposes 3 slots (property). Unsubscribe → suppress. Questions → drafts an answer for one-click approval | Property replies: you take the demo |
| Ad optimiser | Daily 07:30 | Pulls Meta / Google / TikTok / LinkedIn spend and conversions into `growth_ad_metrics`, pauses ad sets with CPA > 2× target after €50 spend, reallocates budget to winners within the cap you set, proposes 2 new creative angles from top performers | Budget cap set by you; new creatives go to approval queue |
| Creative factory | Weekly Tue | Produces 10 ad variants: copy (SR/EN), static images and short vertical videos of the chat flow (Magnific MCP for imagery, screen capture of the live app for product shots), uploaded as drafts to each ad platform | You approve the batch (10 min) |
| Content & SEO | Weekly Wed | Writes one blog post / landing page per vertical and city ("online zakazivanje za frizerski salon u Nišu"), publishes to `apps/marketing`, submits sitemap | Auto |
| Social | Daily | Posts to Balkina Instagram, TikTok, LinkedIn from the creative bank; answers comments and DMs with the FAQ | Auto |
| Reporter | Weekly Fri 17:00 | One-page growth report: leads, claims, signups, activations, demos, pipeline, CAC per channel, what the optimiser changed, what it recommends; emailed to you | Read it |

Routines are created with the claude-code-remote `create_trigger` tool, each in fresh-session mode with a standalone prompt that points at the admin Growth API. Anything browser-only (LinkedIn connection requests, Meta Ads Manager actions the API doesn't expose) runs in a Cowork session with the Chrome extension at human pace. LinkedIn automation stays low volume and human-paced on purpose: account bans would cost more than the time saved.

### 3.3 Where Cowork fits versus Claude Code

- Claude Code (this repo + Routines): everything that reads or writes our own data, sends email, calls ad APIs, generates content and reports. Deterministic, scheduled, logged.
- Cowork (desktop, your logins): LinkedIn Sales Navigator searches and messaging, Meta Ads Manager and Google Ads UI work before API access is approved, TikTok Ads Manager uploads, G2/Capterra listings, event registrations, anything behind your personal login.
- Claude Agent SDK (later): replace the Personaliser and Reply-triage Routines with always-on agents once volume exceeds a few hundred emails a day.

### 3.4 What stays human

1. Ad platform accounts, billing, developer-token applications (Google Ads API basic access takes days to approve).
2. Approving the first week of any new sequence or creative batch.
3. White-label demos and pricing conversations.
4. Consent and legal judgment calls (see section 9).

---

## 4. Marketing plan

### 4.1 Tenant product

Goal: cheap, measurable signups from Instagram-native service businesses. Target blended CAC ≤ €60 (two months of the €29 average plan).

**Tracking first (week 1):** Meta Pixel + Conversions API, Google Ads tag, TikTok pixel on `apps/marketing`; UTM on every link; signup, "page live", "first booking" and "paid" events posted server-side so ad platforms optimise toward activation, not clicks.

Channels in priority order:

1. **Meta (Instagram + Facebook)**, ~55% of tenant budget
   - Campaign A, "Claim your page" (conversion): targets Facebook page admins in beauty, wellness, fitness, dental in Belgrade, Novi Sad, Niš, Podgorica, Budva, Split, Zagreb. Creative: 15-second vertical video of a customer booking in the chat, ending on the tenant dashboard. CTA: "Besplatno. Spremno za popodne."
   - Campaign B, "Stop losing midnight bookings" (lead form): Instant Form asking business name + Instagram handle; the Pre-provisioner builds their page from the handle and the Sender emails the claim link within an hour.
   - Campaign C, retargeting: visitors of the deck and pricing page, video viewers 50%+, lead-form openers who didn't submit.
   - Campaign D, lookalikes of activated tenants once we have 100+.
2. **Google Search**, ~25%
   - Exact and phrase match in SR/HR: "online zakazivanje", "aplikacija za zakazivanje termina", "zakazivanje termina frizer", "program za salon", "rezervacija termina online", "booking sistem", plus competitor terms (Fresha, Booksy, Treatwell, Calendly, SimplyBook).
   - One landing page per vertical generated by the Content Routine, with the chat demo embedded.
3. **TikTok**, ~10% test
   - Same vertical video; TikTok reach in the Balkans is cheap and salon owners are on it. Kill if CPA > 2× Meta after €300.
4. **YouTube in-stream**, ~10%
   - Placements on Serbian/Croatian hair, nail and fitness tutorial channels.
5. **Owned and zero-cost**
   - Referral: tenant refers a tenant → both get a free month. Built into the dashboard; the Reporter tracks it.
   - App Store / Play Store ASO for the customer app ("zakaži frizera", "rezerviši masažu").
   - Google Business Profile for Balkina; Capterra, GetApp, G2, SaaSHub listings (Cowork fills them).
   - Facebook groups for salon and barber owners in the region (Social Routine posts helpful content, not pitches; a human answers questions).
   - Partnerships: beauty-supply distributors, barber academies, accounting firms serving SMBs, Bokun's partner directory for tour operators. Outreach handled as a small "partner" segment in the same engine.
   - Trade fairs: beauty and cosmetics fairs in Belgrade and Zagreb, tourism fairs in Belgrade and Podgorica. Claude builds the attendee and exhibitor lists; you decide whether to attend.

**Creative angles to test (Creative Factory seeds):** "Rezervacije u 2 ujutru" (bookings at 2 a.m.), "Jedan link za Instagram" (one link for Instagram), "Vaši stalni klijenti se vraćaju sami" (regulars come back on their own), "Manje nedolazaka" (fewer no-shows), "Viator i GetYourGuide u jednom kalendaru" (for tour operators).

### 4.2 White-label product

Goal: 10–15 qualified conversations per month, 2–3 demos, one pilot in the first 90 days. Paid media only supports the outbound; it does not carry it.

1. **LinkedIn Sponsored Content + Document Ads**: audience = the title list above at marina operators, resort developers, hotel groups and mall operators in Montenegro, Croatia, Greece, Cyprus, Italy, Spain, UAE, Saudi Arabia. Creative = a 6-slide document ad cut from the white-label deck plus the Portonovi story. Budget €800–1,200/mo. Retarget deck visitors.
2. **LinkedIn InMail / Message Ads** to the top 200 accounts, timed with the email sequence.
3. **Google Search (low volume, high intent)**: "resort guest app", "marina resident app", "white label concierge app", "tenant booking platform shopping centre", "branded residences community app". Capture to a dedicated landing page with the Portonovi walkthrough.
4. **Events and press**: marina industry (ICOMIA World Marinas Conference, METSTRADE, Monaco Yacht Show, boot Düsseldorf, Croatia Boat Show), hospitality investment (Adria Hotel Forum, HOTCO, SEE Hospitality & Tourism Forum), retail real estate (MAPIC), mixed-use (Expo Real). Claude builds the exhibitor and speaker list before each one and runs a pre-event sequence; you attend the two or three that matter. Verify dates each year.
5. **Case study + PR**: a Portonovi case study (with their permission) pitched to Marina World, Superyacht/marina trade press, Hospitality Net, SEE business press. The Content Routine drafts; you approve.

---

## 5. Sales plan

### 5.1 Tenant list building

Source matrix, all automatable:

| Source | How | Yield |
|---|---|---|
| Google Places Text Search (we already have `GOOGLE_MAPS_API_KEY`) | vertical keyword × city list, in local language, paginated | Thousands per country; the backbone |
| Website scrape | emails, WhatsApp numbers, service menus, prices | Email on ~40% of SMB sites |
| Instagram public profile | handle, bio link, booking-by-DM signal, follower count (ICP signal) | Handle for most beauty businesses |
| Bokun / Viator / GetYourGuide listings | tour operators by destination | Hundreds per coast |
| Facebook business pages | category + city | Fills email/phone gaps |

Scoring: +2 Instagram with "DM to book" in bio, +2 reviews ≥ 20 and rating ≥ 4.3, +1 website without a booking widget, +1 vertical in tiers 1–2, −3 already on Fresha/Booksy (still contact later with a switch offer).

Target in 90 days: 15,000 scored prospects across SR/ME/HR, 6,000 with a verified email, 2,500 pre-provisioned pages.

### 5.2 White-label named-account list

Seed list to verify and expand (Claude builds the full 200; these are starting points, not confirmed opportunities):

- Montenegro: Porto Montenegro, Luštica Bay, Dukley (Budva), Kolašin 1600, Hotel groups on the Budva riviera, Big Fashion and Mall of Montenegro (Podgorica)
- Croatia: ACI marinas network, D-Marin marinas, Marina Kaštela, Sun Gardens Dubrovnik, Punta Skala / Falkensteiner, Arena Centar and Westgate (Zagreb), Mall of Split
- Serbia: Belgrade Waterfront (Eagle Hills), Galerija Belgrade, Ušće, Ada Mall, BEO Shopping Center, Rajićeva, Kopaonik resort operators
- Bosnia / North Macedonia / Bulgaria / Albania: Jahorina resort, Sarajevo City Center, Skopje City Mall, East Gate Mall, Bansko resort operators, Vlora Marina, Galata
- Mediterranean: Limassol Marina, Ayia Napa Marina, Camper & Nicholsons-managed marinas, Marina di Portofino-type destinations in Italy, Costa Smeralda, Puerto Banús, Sotogrande
- Gulf: Dubai Marina and Dubai Harbour, Yas Marina (Abu Dhabi), Jeddah Yacht Club, Red Sea Global destinations, Emaar and Aldar community-management arms

Sources for expansion: marina directories (TransEurope Marinas, marinas.com, Blue Flag marina lists), hotel-group portfolio pages, mall operator portfolios (NEPI Rockcastle, Supernova, CPI), LinkedIn Sales Navigator (company size 50–1000, industry Hospitality / Real Estate / Leisure), MAPIC and ICOMIA exhibitor lists, Cushman & Wakefield and CBRE retail reports for the region.

Contact discovery: LinkedIn Sales Navigator (via Cowork), Apollo.io or Hunter.io API for emails, company switchboard as a fallback. Store the consent basis for every contact (legitimate interest, B2B).

### 5.3 Sequences

**Tenant — "Your page is ready" (6 touches, 14 days, email; optional SMS on step 4 only where we have a business line and the country allows B2B SMS)**

1. Day 0: "[Salon name] — napravili smo vam stranicu za zakazivanje" (we built your booking page). Shows their three real services with prices, screenshot of their page, one-click claim link. Free tier, no card.
2. Day 2: the 2 a.m. booking story in their vertical; link to the 40-second demo.
3. Day 5: "one link for Instagram" — exact instructions for replacing linktr.ee or "DM to book".
4. Day 8: social proof from a nearby business (once we have one per city); SMS variant: "Vaša stranica: [link] — važi još 7 dana".
5. Day 11: smart rebooking + no-show reduction, with their own numbers if reviews mention no-shows or waiting.
6. Day 14: last touch, "we'll take the page down on [date] unless you claim it", plus a reply-to-unsubscribe line.

Replies classified by the Reply-triage Routine; "interested" gets an instant answer plus a walkthrough booking link served by Balkina itself (dogfooding the product is part of the pitch).

**White-label — named account (4 email + 3 LinkedIn touches, 21 days)**

1. Day 0 email: one paragraph on their property by name (number of on-site businesses, events calendar, residences), the Portonovi result in one line, link to the live portal, ask for 20 minutes.
2. Day 1 LinkedIn: connection request, no pitch.
3. Day 4 email: the two-audience framing (tenants + residents), a 3-slide excerpt from the deck.
4. Day 7 LinkedIn: short message pointing at the Portonovi walkthrough.
5. Day 12 email: "build vs generic tools vs white-label" slide with a cost comparison for a property their size.
6. Day 16 LinkedIn: share the case study post, tag nothing.
7. Day 21 email: breakup with a standing offer of a three-week pilot.

Every interested reply → you take the demo; Claude prepares a one-page account brief 30 minutes before (property facts, who replied, likely objections, suggested tier).

### 5.4 Demo and close

- Tenant: no demo. The product is the demo. Activation emails and in-app nudges (already in the roadmap) carry the user to the first booking. Paid conversion is handled by the existing plan picker.
- White-label: one 20-minute walkthrough on the live Portonovi portal, then a proposal generated by Claude from a template (tier, included businesses, timeline "three weeks to live", pilot terms). Follow-ups are a mini-sequence until signed or dead.

---

## 6. Build backlog (for Claude Code, in order)

Each item is a separate PR on this repo. Estimates are working sessions, not calendar days.

1. **Tracking and attribution** (1 session): pixels and server-side events on `apps/marketing` and `apps/web` signup; UTM capture stored on `tenants`.
2. **Migration 068 + Growth admin section** (2 sessions): tables above, RLS, admin pages (prospects, inbox, approval queue, metrics), Resend outreach subdomain with SPF/DKIM/DMARC, Resend inbound webhook.
3. **Prospector + Enricher** (2 sessions): Places search matrix, website/Instagram extraction, scoring; runs as a Routine.
4. **Pre-provisioner + claim flow** (2 sessions): reuses `provisionTenantDefaults` (already on the roadmap), hidden visibility until claimed, claim page that converts to a normal self-serve tenant.
5. **Sequencer + Sender + Reply triage** (2 sessions): templates in `packages/email-templates`, enrollment engine, caps, suppression, classification.
6. **Ad metrics pull + optimiser** (2 sessions): Meta Marketing API first (immediate), Google Ads API once the developer token is approved, TikTok and LinkedIn via CSV export through Cowork until API access.
7. **Creative factory + content routine** (1 session): prompts, Magnific pipeline, landing page generator for vertical × city.
8. **Reporter** (0.5 session).
9. **Referral programme** (1 session): code per tenant, free-month credit on activation of the referred tenant.

Routines are registered after items 3, 5, 6 and 8 land.

---

## 7. 90-day timeline

**Weeks 1–2: Foundations.** Tracking, migration, admin Growth section, outreach domain warm-up (start at 20 emails/day, double weekly), ad accounts and pixels, LinkedIn page and Sales Navigator, first 2,000 tenant prospects and the 200-account property list. First Meta and Google campaigns live by day 10 with the deck videos as creative.

**Weeks 3–4: First sequences.** Pre-provision the first 300 tenant pages in Belgrade and Novi Sad; send the "page is ready" sequence with you approving every email the first week. Start the white-label sequence on the top 50 accounts. Creative Factory delivers the first 10 variants. First Reporter email.

**Weeks 5–8: Scale what works.** Remove approval gates on sequences that hit ≥ 3% claim rate; expand cities (Niš, Podgorica, Budva, Split, Zagreb) and verticals; optimiser running daily; TikTok and YouTube tests; referral live; Portonovi case study published; next 100 property accounts enrolled; first demos.

**Weeks 9–12: Second geography and pilot close.** Croatia and the diaspora cities fully in the prospect matrix; lookalike audiences; event pre-sequences for the next two conferences; close one white-label pilot; decide on Agent SDK migration for triage and personalisation.

---

## 8. Targets, budget, KPIs

Targets for day 90 (ambitious but defensible for the budget below):

| Metric | Tenant | White-label |
|---|---|---|
| Prospects scored | 15,000 | 200 named accounts |
| Pages pre-provisioned / contacts enrolled | 2,500 | 200 |
| Claims / replies | 150 claims | 25 replies |
| Activated (first booking) / demos | 75 | 8 demos |
| Paying / signed | 40 paying | 1 pilot signed |
| CAC | ≤ €60 blended | n/a |

Monthly budget to start, scaled by the optimiser inside caps you set:

| Line | €/month |
|---|---|
| Meta ads (tenant) | 1,200 |
| Google Search (tenant + property) | 600 |
| TikTok + YouTube tests | 400 |
| LinkedIn (property) | 1,000 |
| Resend volume, Apollo/Hunter credits, Places API, Sales Navigator | 350 |
| Total | ~3,550 |

Weekly KPIs in the Reporter: spend, leads, claims, signups, activation rate, CAC per channel, email deliverability (bounce < 3%, spam complaints < 0.1%), reply rate, demos, pipeline value, Routine failures.

---

## 9. Compliance and risk

- **Email**: B2B outreach to business addresses on legitimate interest is workable in Serbia, Montenegro and the EU, provided every email identifies us, has a working unsubscribe, and we suppress on request. Keep per-contact consent basis in `growth_contacts`. Separate sending subdomain so the product domain's reputation is never at risk.
- **SMS and WhatsApp**: no cold WhatsApp (policy violation, number bans). SMS only to business lines, only one touch, only in countries where B2B marketing SMS is permitted; otherwise drop step 4's SMS.
- **Pre-provisioned pages**: keep them unlisted and unsearchable until claimed, use only publicly listed facts, and delete them after 30 days if unclaimed. Never let an unclaimed page take a real booking.
- **LinkedIn**: human-paced via Cowork, under 50 connection requests a day, no scraping tools on the account.
- **Ads**: Stripe is not available in Serbia or Montenegro, so tenant ads must not promise online payments; the `payments_enabled` flag already keeps the product honest.
- **Data**: prospect data lives in our Supabase, service-role only, no export to third-party tools beyond email-finding APIs.

---

## 10. Decisions needed from you

1. Confirm first geography and the city order (proposal: Belgrade, Novi Sad, Podgorica, Budva, Niš, Split, Zagreb).
2. Monthly ad cap for the optimiser (proposal: €3,200 media, split as above).
3. Ad and data accounts to create or share: Meta Business Manager, Google Ads (and apply for API basic access now), TikTok Ads, LinkedIn Campaign Manager + Sales Navigator, Apollo or Hunter, a Resend outreach subdomain such as `go.balkina.ai`.
4. Permission from Portonovi to be named in the case study and ads.
5. Whether to build the growth engine in-repo as proposed (recommended) or to run outreach from HubSpot/Lemlist with Claude driving them through connectors (faster week 1, weaker long-term control).

Once you answer 1–3, the first build PR (tracking + migration 068 + Growth admin) can start immediately.
