# Growth Routines

Scheduled jobs that run the growth engine (see `docs/GTM_GROWTH_PLAN.md`, section 3.2).
Each Routine is a Claude Code Routine in fresh-session mode, or a plain cron hitting the
admin app's unattended endpoints. Both need the same secret.

## Environment variables (admin Vercel project)

| Var | Purpose |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Already set. Must have **Places API (New)** enabled in Google Cloud Console. |
| `GROWTH_CRON_SECRET` | New. Any long random string. Sent as `Authorization: Bearer …` to `/api/growth/cron/*`. |

## Endpoints

| Endpoint | Auth | What it does |
|---|---|---|
| `POST /api/growth/cron/prospect` | bearer `GROWTH_CRON_SECRET` | Runs the next N due search targets through Google Places and upserts `growth_prospects`. Body: `{ "limit": 20, "max_pages": 3, "segment": "tenant" }`. |
| `POST /api/admin/growth/prospector` | admin session | Same, from the admin UI. |

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

## Routines still to build (in plan order)

1. Enricher — website/Instagram extraction → `growth_prospects.enrichment`, `growth_contacts`.
2. Pre-provisioner — unclaimed tenant from enrichment via `provisionTenantDefaults`.
3. Personaliser + Sender + Reply triage — `growth_sequences`, `growth_enrollments`, Resend.
4. Ad optimiser — `growth_ad_metrics` from Meta / Google / TikTok / LinkedIn.
5. Reporter — weekly email.
