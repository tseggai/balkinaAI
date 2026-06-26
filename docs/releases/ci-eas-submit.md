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

### 3. Android (Google Play)
Build signing is already set in EAS (keystore present). To **submit** to Play
and to deliver **push** on Android, do the following one-time setup. Package id
is `com.tseggaid.balkinaai`.

**3a. Create the app + first manual upload (required — can't be automated).**
1. Play Console → **Create app** (name "Balkina AI", free), then complete the
   required tasks (privacy policy, Data safety, content rating, target audience).
2. Build an AAB and upload it **by hand once** — Google blocks automated tools
   from creating the first release:
   ```bash
   eas build --profile production --platform android   # download the .aab
   ```
   Play Console → Internal testing → Create release → upload the .aab → roll out.
   After this first manual release, `eas submit` works for every release after.

**3b. Service account for `eas submit`.**
1. Play Console → **Setup → API access** → link/create a Google Cloud project →
   create a **service account** (opens Google Cloud).
2. Google Cloud → IAM → Service Accounts → create a **JSON key** → download.
3. Play Console → **Users and permissions** → invite the service-account email →
   grant **Release to testing tracks** (and Production when ready) for the app.
4. Register it in EAS: `eas credentials` → Android → production → **Google
   Service Account** → upload the JSON (keep it out of git). The
   `production.android` submit profile targets the **internal** track as a draft.

**3c. FCM V1 (only needed for Android push — resident/campaign/booking notifs).**
1. Firebase Console → add an Android app with package `com.tseggaid.balkinaai` →
   download `google-services.json`; reference it via
   `expo.android.googleServicesFile` and rebuild.
2. Firebase → Project settings → **Service accounts** → generate a private key →
   upload to EAS: `eas credentials` → Android → **FCM V1**.

Build Android via the **manual run** (platform: `android` or `all`); tag pushes
are iOS-only by design.

## Running a release
**iOS (tag):** bump `version` in `apps/mobile/app.json`, then
`git tag vX.Y.Z && git push origin vX.Y.Z`. Set the build's "What's New" in App
Store Connect and submit for review.

**Manual (any platform/variant):** Actions → **Mobile — EAS build & submit** →
Run workflow → pick profile / platform / variant / submit.
