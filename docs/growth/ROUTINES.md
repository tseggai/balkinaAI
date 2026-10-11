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

## Routines still to build (in plan order)

1. Personaliser + Sender + Reply triage — `growth_sequences`, `growth_enrollments`, Resend.
2. Ad optimiser — `growth_ad_metrics` from Meta / Google / TikTok / LinkedIn.
3. Reporter — weekly email.
4. Unclaimed-page cleanup — delete unclaimed tenants 30 days after their claim link expires.
