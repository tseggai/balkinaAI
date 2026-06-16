# White-Label Property Builds

A white-label build reskins the standard Balkina customer app for a single
property (resort, marina, hotel, food hall) and boots it into that property's
branded **storefront** — discovery is scoped to the property's businesses.

The variant is selected at runtime by the `APP_VARIANT` environment variable,
read by `app.config.js`. The same variable works for Expo Go and EAS builds, so
there is no separate generate step to remember.

## 1. Create the property in the database

Use the admin/property panel (or SQL) to create a `properties` row with branding
(`name`, `slug`, `logo_url`, `cover_image_url`, `primary_color`, `welcome_message`)
and link its businesses via `property_tenants` (set `featured` on the highlights).

## 2. Create a variant config

Copy the template and edit the values:

```bash
cp white-label/template.json white-label/<property-slug>.json
```

`propertySlug` **must** match the `properties.slug` in the database — that is what
the app uses to fetch branding, businesses, and experiences.

(`white-label/portonovi.json` already exists as a working example.)

## 3. Test in Expo Go

```bash
APP_VARIANT=portonovi npx expo start
```

Open in Expo Go — the app boots into the Portonovi storefront. Without
`APP_VARIANT` the standard chat-first Balkina app loads.

> The storefront fetches from the API in `app/(app)/index.tsx` (`API_BASE`,
> `https://app.balkina.ai`). Cover photos on business cards and the Experiences
> section depend on the `/api/properties` + `/api/booking/services` changes being
> deployed; the hero cover and business list work against any deployment.

## 4. Build & submit (EAS)

```bash
APP_VARIANT=portonovi eas build --profile production --platform ios
eas submit --platform ios
```

Icon/splash are only applied if the referenced asset files exist under
`white-label/assets/<slug>/`, so a variant without art still builds and runs.

> `generate.js` (which writes `app.whitelabel.json`) is legacy and no longer
> required — `app.config.js` handles variant selection directly.

## 5. Legal & support links — per-property TODO (NOT yet white-labeled)

The Profile → **Settings** sheet still links to **Balkina's** legal/support
endpoints, even inside a property build. These are intentionally left as the
platform defaults until each property supplies its own, because they are real,
load-bearing links (app-store review requires working Terms/Privacy), and there
is no property-specific equivalent to point at yet.

**Where they live:** `apps/mobile/app/(app)/profile.tsx` → `SettingsModal`
- Terms of Service → `https://balkina.ai/terms`
- Privacy Policy → `https://balkina.ai/privacy`
- Contact Support → `mailto:support@balkina.ai`

**Per-property requirement:** every white-label property must provide its own
Terms URL, Privacy URL, and a support contact (email or URL) before store
submission. Treat this as a required onboarding checklist item, not optional.

**Recommended systematic fix (do once, applies to all properties):**

1. **Store the values with the property, not the build.** Add columns to the
   `properties` table: `terms_url`, `privacy_url`, `support_email`,
   `support_url` (nullable). This lets them be edited in the property panel and
   updated without an app rebuild — preferred over baking into the variant JSON.
2. **Expose them** via `GET /api/properties?slug=…` (the same payload the
   storefront already fetches in `app/(app)/index.tsx`).
3. **Thread into the app.** Pass the values into `ProfileScreen` /
   `SettingsModal` and use them when present, falling back to the Balkina
   defaults above when null (so the Balkina app is unaffected). If a property
   has none, hide that specific row rather than show a Balkina link.
4. **Build-time fallback (optional).** For fully offline-correct branding before
   the API responds, also mirror the URLs into the variant JSON under `extra`
   (e.g. `termsUrl`, `privacyUrl`, `supportEmail`) and read via
   `Constants.expoConfig.extra` — same pattern as `primaryColor`/`propertyName`.

**Per-property onboarding checklist (legal/support):**
- [ ] `properties.terms_url` set to the property's Terms of Service
- [ ] `properties.privacy_url` set to the property's Privacy Policy
- [ ] `properties.support_email` (and/or `support_url`) set to the property's support contact
- [ ] Verified the three links open correctly in the property build before EAS submit

> Until the above is built, a property build will show Balkina's legal/support
> links. That is acceptable for internal demos but **must** be resolved before
> any public/App Store release of a property app.
