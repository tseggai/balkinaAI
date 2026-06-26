# CI: EAS build & submit

The **Mobile — EAS build & submit** workflow (`.github/workflows/eas-submit.yml`)
builds the Expo app on EAS and optionally submits it to the store. It runs on
demand (Actions tab → Run workflow) with inputs:

- **profile** — `production` (store), `preview` (internal), or `preview-portonovi`.
- **platform** — `ios`, `android`, or `all`.
- **variant** — white-label slug (e.g. `portonovi`); blank = base Balkina AI.
- **submit** — submit to the store after the build (`--auto-submit`).

Build numbers auto-increment remotely (`eas.json` → `appVersionSource: remote`);
the marketing `version` comes from `apps/mobile/app.json`.

## One-time setup

### 1. `EXPO_TOKEN` (required)
Create a robot/personal access token at <https://expo.dev/accounts/[account]/settings/access-tokens>
and add it as a repo secret: **Settings → Secrets and variables → Actions → New
repository secret** → `EXPO_TOKEN`. This is all the workflow itself needs.

### 2. iOS — App Store Connect API key (stored in EAS, not in GitHub)
`eas.json`'s iOS submit config is API-key based (no `appleId`), so submission is
non-interactive. Upload the key to EAS once:

1. App Store Connect → **Users and Access → Integrations → App Store Connect
   API** → create a key with the **App Manager** role. Download the `.p8`
   (one-time) and note the **Key ID** and **Issuer ID**.
2. From a logged-in machine, in `apps/mobile/`:
   ```bash
   eas credentials            # iOS → production → App Store Connect API Key → set up
   ```
   (or upload it under the project's **Credentials** in the EAS dashboard).

After that, the workflow's `eas submit` uses the stored key automatically.

### 3. Android — Google Play service account (only if you submit Android)
Add a Google Play service-account JSON to EAS (`eas credentials`, or
`serviceAccountKeyPath` in `eas.json`). The `production.android` submit profile
targets the `internal` track as a draft.

## Running a release
1. Bump `version` in `apps/mobile/app.json` if it's a marketing bump.
2. Actions → **Mobile — EAS build & submit** → Run workflow → profile
   `production`, platform `ios`, submit ✓.
3. Set the build's "What's New" in App Store Connect, then submit for review.
