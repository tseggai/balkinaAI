# Growth Routines

Scheduled jobs that run the growth engine (see `docs/GTM_GROWTH_PLAN.md`, section 3.2).
Each Routine is a Claude Code Routine in fresh-session mode, or a plain cron hitting the
admin app's unattended endpoints. Both need the same secret.

## Environment variables (admin Vercel project)

| Var | Purpose |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Already set. Best with **Places API (New)** enabled (a separate service from "Places API") and included in the key's API restrictions. If the new API returns 403 the prospector falls back to the legacy Places API (Text Search + Place Details), which works with the legacy "Places API" alone but costs roughly one extra request per business. |
| `GROWTH_PLACES_API` | Optional: `new` or `legacy` to force one API instead of auto-fallback. |
| `GROWTH_CRON_SECRET` | New. Any long random string. Sent as `Authorization: Bearer …` to `/api/growth/cron/*`. |
| `GROWTH_CLAIM_BASE_URL` | Optional (admin project). Base URL for claim links, default `https://balkina.ai`. `NEXT_PUBLIC_CLAIM_BASE_URL` does the same for the admin UI copy button. |
| `OPENAI_API_KEY` | Optional for the enricher. Enables services/prices/hours/owner extraction with `gpt-4o-mini` (override with `GROWTH_LLM_MODEL`). Without it the enricher still finds emails, phones, socials and booking widgets. |

## Endpoints

| Endpoint | Auth | What it does |
|---|---|---|
| `POST /api/growth/cron/prospect` | bearer `GROWTH_CRON_SECRET` | Runs the next N due search targets through Google Places and upserts `growth_prospects`. Body: `{ "limit": 20, "max_pages": 3, "segment": "tenant" }`. |
| `POST /api/admin/growth/prospector` | admin session | Same, from the admin UI. |
| `POST /api/growth/cron/enrich` | bearer `GROWTH_CRON_SECRET` | Enriches the next N un-enriched prospects (highest ICP first): fetches website + contact page, extracts emails/phones/socials/booking widget, optional LLM extraction, creates `growth_contacts`, moves stage new → enriched. Body: `{ "limit": 40, "segment": "tenant" }`. |
| `POST /api/admin/growth/enricher` | admin session | Same, from the admin UI; also accepts `prospect_ids` or `search_target_ids` for scoped runs. |
| `POST /api/admin/growth/generate` | admin session | Step 1 of "Generate prospects": upserts search targets for cities × business types and returns their ids; the UI then runs the prospector and enricher over them in chunks. |
| `POST /api/admin/growth/preprovision` | admin session | Builds unclaimed booking pages (tenant `status='unclaimed'`, location, owner staff, services) for `prospect_ids` or the next `limit` enriched prospects; issues 30-day claim tokens. |
| `POST /api/claim` (marketing site) | public, token | Claims a page: creates the owner login, links it to the tenant + staff, activates the tenant, marks the prospect claimed. Page: `/claim/<token>`. |

## Routine 1 — Daily prospector

- Schedule: `CRON_TZ=Europe/Belgrade 0 6 * * *`
- Mode: fresh session, no repo needed (pure HTTP).
- Cost guard: 20 targets × 3 pages = 60 Places requests per day (~€2/day at Enterprise SKU pricing).

Prompt:

```
You are the Balkina growth prospector. Call the unattended prospector endpoint once:

  POST https://<admin-domain>/api/growth/cron/prospect
  Authorization: Bearer $GROWTH_CRON_SECRET
  Content-Type: application/json
  {"limit": 20, "max_pages": 3}

Then report in one short message: targets_run, places_found, inserted, updated, api_requests,
and any errors. If stopped_reason is set, say so clearly and do not retry — it means the Google
key or billing needs attention. Do nothing else.
```

Vercel Cron alternative (`apps/admin/vercel.json`):

```json
{ "crons": [{ "path": "/api/growth/cron/prospect", "schedule": "0 4 * * *" }] }
```

Vercel sends `Authorization: Bearer $CRON_SECRET`; the endpoint accepts that too.

## Routine 2 — Daily enricher

- Schedule: `CRON_TZ=Europe/Belgrade 0 7 * * *` (after the prospector).
- Cost guard: 40 prospects × up to 2 page fetches + one `gpt-4o-mini` call (~12k input tokens) ≈ a few cents per day.

Prompt:

```
You are the Balkina growth enricher. Call the unattended enricher endpoint once:

  POST https://<admin-domain>/api/growth/cron/enrich
  Authorization: Bearer $GROWTH_CRON_SECRET
  Content-Type: application/json
  {"limit": 40}

Report in one short message: processed, enriched, skipped, emails_found, contacts_created,
llm_used, and the first few errors. If llm_configured is false, say that OPENAI_API_KEY is
missing on the admin project. Do nothing else.
```

Vercel Cron: already in `apps/admin/vercel.json` (`0 5 * * *` UTC).

## Pre-provisioner (on demand, from the Prospects page)

Not scheduled: pages are built from the admin UI ("Build booking pages" on selected rows) so a human decides which businesses get one. Unclaimed tenants are invisible to customers (discovery and `/b/<slug>` filter `status = 'active'`). Claim links expire after 30 days; the next build on the same prospect refreshes the token.

## CRM (manual outreach, Migration 070)

Not a routine: the Prospects page is the CRM. Each row shows last activity, sends, page views and time on page, and the follow-up due chip; the "Due today" tab is the follow-up queue. Expanding a row opens the composer (first touch / follow-up / last chance, CG or EN, channel-tagged claim link) with **Open WhatsApp & log**, **Copy & open Instagram DM** and **Copy & log**; every send writes a `sent` event and schedules the next follow-up (2 days after the first touch, 3 after the follow-up). Replies, calls and notes are logged by hand. The `growth_events_apply` trigger turns events into stage moves and counters, so the claim page (marketing) and the admin feed the same timeline.

## Routine 3 — Instagram publisher (Migrations 071–072)

Posts the planned feed image and its matching story on a schedule you control from the admin page.

- **Plan**: `apps/admin/src/lib/ig/plan.ts` — 40 rows in posting order (set, file, vertical, SR + EN caption). Same order as the POSTING-PLAN.pdf that ships with the asset zips.
- **Schedule** (DB): `ig_settings` = first posting day, local time, weekdays, timezone, paused. Rows fill the chosen weekdays in plan order. `ig_overrides` = per-row custom time, skip, feed/story only. Effective time per row is computed in `lib/ig/schedule.ts`.
- **Images**: `https://balkina.ai/ig/set<N>/<sq|st>/sr/<file>.jpg` (committed under `apps/marketing/public/ig/`).
- **Trigger**: pg_cron `ig-publisher` every 15 min → `POST https://admin.balkina.ai/api/growth/cron/instagram` with `Authorization: Bearer <ig_settings.cron_secret>` (pg_net). Vercel cron (`0 17 * * 1,3,5`) stays as a daily fallback. Both are idempotent.
- **Endpoint**: publishes every row whose time has passed (36h grace), feed first then story, logging to `ig_publish_log`; failed attempts retry every 2h, 3 attempts max, 3 rows per run. `?dry=1` lists what is due and checks the token; `?row=set1/09-photo-barber&only=feed` forces one row.
- **Admin UI**: `/dashboard/instagram` — connection check, schedule card, plan table with state pills (Scheduled / Due / Published / Failed / Missed / Skipped), click a date to edit one row, select rows for bulk shift / set time / skip / enable / kinds / back to plan, Post now / Feed only / Story only / Reset. Confirmations and results are centred in-app dialogs.
- **Env (admin Vercel project)**: `META_IG_ACCESS_TOKEN` (60-day Instagram Login token), optional `IG_ASSET_BASE`, `IG_LANG`; `META_IG_LOGIN=facebook` + `META_IG_USER_ID` for the legacy flavour. `IG_PLAN_START` only seeds the start when the DB has none.
- **Meta setup once**: Instagram switched to Business/Creator → app at developers.facebook.com → use case "Manage messaging & content on Instagram" → Customize → add `instagram_business_basic` + `instagram_business_content_publish` → "API setup with Instagram login" → Add account (Instagram Tester role; accept the invite in Instagram → Settings → Apps and websites → Tester invites) → Generate token. Every call uses the `me` node, so no user id is needed (the 17-digit id shown under the account is app-scoped and is NOT a Graph node).
- **Token (Migration 077)**: paste the 60-day token on the Instagram page (Connections → Instagram → Connect / Replace). It is checked against the account, stored in `ig_settings` and **refreshed automatically** by the publisher when it is within 10 days of expiring (Instagram refuses to refresh tokens younger than 24 h). Test, Refresh and Disconnect live on the same card. `META_IG_ACCESS_TOKEN` in Vercel is only a fallback when nothing is stored and cannot be refreshed from the app.
- **Limits**: the API cannot add story stickers (the link sticker). Story images carry `balkina.ai` as text; add the sticker by hand when you want the tap. Rate limit is 100 API-published posts per 24h.

## Canva studio (Migrations 073–074)

Posts are designed as Canva brand templates and filled from the admin.

- **Connect once**: `/dashboard/instagram` → Canva templates card → Connect Canva (OAuth, PKCE). Requires `CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET` in the admin Vercel project, the integration's redirect URL set to `https://admin.balkina.ai/api/admin/canva/callback`, scopes `design:content:read design:content:write design:meta:read brandtemplate:meta:read brandtemplate:content:read asset:read asset:write`, and MFA on the Canva account.
- **Templates are per business category** (one square + one story each; `apps/admin/src/lib/ig/categories.ts` is the list): `IG · 01 health · square`, `IG · 02 beauty · square`, `IG · 03 fitness · square`, `IG · 04 home · square`, `IG · 05 professional · square`, `IG · 06 education · square`, `IG · 07 pets · square`, `IG · 08 auto · square`, `IG · 09 events · square`, `IG · 10 food · square`, `IG · 11 rentals · square`, `IG · 12 hospitality · square`, and the same twelve with `story`. The number is optional and only orders the list; the word must match the category key. Every audience in the studio belongs to one category and renders through that category's template, so the eyebrow, url, logo and background pattern stay constant per category and only the headline, subline and photo change.
- **Fields**: in Canva, Apps → Bulk Create → "Enter data manually" with columns `eyebrow`, `headline`, `subline`, `url` (text) and `photo` (image); fill one sample row, Done, then select each element on the canvas → Connect data → field (the photo must sit in a Frame). The **eyebrow is filled by the studio with the category name in the post's language** (`BEAUTY & PERSONAL CARE` / `LEPOTA I NEGA`), never by the copywriter; connect it so the Serbian and English slides each get their own. Keep the headline box in one style: autofill replaces the whole text, so a bold word inside the headline is lost. Share → **Brand Template**, then **Sync from Canva** on the admin. **Show templates → Test render** fills sample copy + a sample photo and shows the exported JPEG (stored in the public `ig-renders` bucket). An extra `logo` image field is fine; the renderer leaves it as designed.
- **Pipeline** (`lib/canva/client.ts` → `renderTemplate`): photo URL → Canva asset → autofill job → export job (JPG q90) → download → `ig-renders/<path>.jpg` → public URL. Canva export links expire after 24h, which is why renders are copied to storage.
- **Studio** (`/dashboard/instagram/studio`, button "+ New post (Studio)"): the page opens with the chosen category's template shown as the post will look (feed carousel SR→EN, stories beside it). **Brief** on one line: template (Auto = the audience's category), audience (grouped by category), tone; then languages (SR / EN chips, both allowed, "SR first" picks the first slide), post (Feed / Story chips), optional brief → **Generate** writes the copy, picks a library photo matched to the audience, creates the post and renders a **text-free base** of the template with that photo (one per format, 20–40 s each). The copy is then laid over the base in the brand font: **click a line to edit it**, **hover for Rewrite** (new wording for that field in both languages, the rest kept), **hover the photo for Shuffle / Change…**. Positions are approximate until rendered. **Render** when happy runs the real Canva renders (every language and format); any later edit returns the preview to draft on the base. The caption (both languages + hashtags) sits under the brief with its own Rewrite. **Schedule** (local date-time) or **Post now**. Bilingual posts go out as a **2-slide feed carousel** (first slide = primary language) and **two stories** back to back (Instagram's API has no story carousels).
- **Generate batch**: how many posts, which audiences (grouped by category; click a category name to toggle all of it) and tones to rotate through, optionally specific templates (default: each post uses its audience's category template), languages, what to post, an optional brief for all, and a cadence (first day, time, timezone, weekdays, posts per day with a gap). Creates the drafts, then writes copy, renders and schedules each one in the browser with a progress bar ("Stop after this step" and "Finish unfinished" resume where it stopped). Slots already taken by scheduled studio posts are skipped. Afterwards every post is editable: Open loads it into the form, re-render, reschedule; the bulk bar on the list does shift days, set time, feed/story, unschedule, delete.
- **Publishing**: the same 15-minute cron publishes due studio posts after the plan rows (36 h grace, 3 attempts, 2 h between retries). "Pause all posting" on the Instagram page pauses studio posts too. `?dry=1` lists them under `duePosts`.
- Still to build: tracks (a cadence per audience) once more layouts exist.

## Routines still to build (in plan order)

1. WhatsApp Business API sender (Twilio, approved templates) + sequence runner on `growth_sequences` / `growth_enrollments` that stops on reply, claim or expiry; inbound reply webhook into `growth_events`. Resend email path for the few prospects with an address.
2. Ad optimiser — `growth_ad_metrics` from Meta / Google / TikTok / LinkedIn.
3. Reporter — weekly email.
4. Unclaimed-page cleanup — delete unclaimed tenants 30 days after their claim link expires.
