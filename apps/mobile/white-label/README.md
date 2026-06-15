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

(`white-label/porto-montenegro.json` already exists as a working example.)

## 3. Test in Expo Go

```bash
APP_VARIANT=porto-montenegro npx expo start
```

Open in Expo Go — the app boots into the Porto Montenegro storefront. Without
`APP_VARIANT` the standard chat-first Balkina app loads.

> The storefront fetches from the API in `app/(app)/index.tsx` (`API_BASE`,
> `https://app.balkina.ai`). Cover photos on business cards and the Experiences
> section depend on the `/api/properties` + `/api/booking/services` changes being
> deployed; the hero cover and business list work against any deployment.

## 4. Build & submit (EAS)

```bash
APP_VARIANT=porto-montenegro eas build --profile production --platform ios
eas submit --platform ios
```

Icon/splash are only applied if the referenced asset files exist under
`white-label/assets/<slug>/`, so a variant without art still builds and runs.

> `generate.js` (which writes `app.whitelabel.json`) is legacy and no longer
> required — `app.config.js` handles variant selection directly.
