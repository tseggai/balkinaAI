# CI: EAS build & submit

The **Mobile — EAS build & submit** workflow (`.github/workflows/eas-submit.yml`)
builds the Expo app on EAS and optionally submits it to the store. Two ways to
run it:

### A. Push a release tag (recommended for releases)
```bash
# version in apps/mobile/app.json should match the tag
git tag v1.2.0 && git push origin v1.2.0
```
A `v*.*.*` tag triggers a **production iOS build + App Store submit** with no
further input. (Build the base Balkina app only; white-label variants go via the
manual run.)

### B. Manual run (Actions → Run workflow)
Inputs:
- **profile** — `production` (store), `preview` (internal), or `preview-portonovi`.
- **platform** — `ios`, `android`, or `all`.
- **variant** — white-label slug (e.g. `portonovi`); blank = base Balkina AI.
- **submit** — submit to the store after the build (`--auto-submit`).

Build numbers auto-increment remotely (`eas.json` → `appVersionSource: remote`);
the marketing `version` comes from `apps/mobile/app.json`. The workflow lives on
the **default branch** to be usable — merge this branch (or cherry-pick the
file) first.

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
Create a service account in Google Cloud with **Play Console** access, grant it
release permissions in Play Console, download the JSON key, and add it to EAS
(`eas credentials` → Android → production → Google Service Account, or
`serviceAccountKeyPath` in `eas.json`). The `production.android` submit profile
targets the `internal` track as a draft. Then build Android via the manual run
(**platform: android** or **all**); tag pushes are iOS-only by design.

## Running a release
**iOS (tag):** bump `version` in `apps/mobile/app.json`, then
`git tag vX.Y.Z && git push origin vX.Y.Z`. Set the build's "What's New" in App
Store Connect and submit for review.

**Manual (any platform/variant):** Actions → **Mobile — EAS build & submit** →
Run workflow → pick profile / platform / variant / submit.
