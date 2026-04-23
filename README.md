# SmartApp Builder — Central GitHub Build Repo

This repo is the **central Capacitor build runner** for the SmartApp platform.
When a user clicks **"Build APK"** in the SmartApp dashboard, our Supabase
edge function triggers the `build-apk.yml` workflow in this repo, which:

1. Downloads the user's project file snapshot from Supabase
2. Drops it into `template/` (a Vite + React + Capacitor scaffold)
3. Runs `npm ci → vite build → cap sync android → gradle assembleDebug`
4. Uploads the resulting APK as a GitHub Release asset
5. POSTs the download URL back to Supabase, which surfaces it in the user's
   dashboard with a QR code.

---

## One-time setup

### 1. Create this repo on GitHub
- Name suggestion: `smartapp-builder` (private is fine)
- Default branch: `main`
- Copy **everything** from `/mnt/documents/smartapp-builder-repo/` into the repo root.

### 2. Add the Capacitor template
Inside this repo, create a `template/` folder containing a normal Vite + React + Capacitor project:

```bash
cd template
npm create vite@latest . -- --template react-ts
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Placeholder" "app.lovable.placeholder" --web-dir dist
git add . && git commit -m "template scaffold"
```

The user's project files will overwrite this template at build time, so the
placeholder values don't matter — `inject-files.js` handles the swap and
`patch-android.js` rewrites `applicationId`, `versionName`, `versionCode`,
and `strings.xml` per build.

> **Important**: commit a `template/package-lock.json` so `npm ci` works.

### 3. Required permissions
This workflow uses `GITHUB_TOKEN` (auto-provided) to create Releases.
Go to **Settings → Actions → General → Workflow permissions** and select
**"Read and write permissions"**.

### 4. Set the matching secrets on the Lovable side
Already done — these are set in your Lovable project:

| Secret | Value |
|---|---|
| `GITHUB_BUILD_PAT` | A GitHub PAT (classic) on your account with `repo` + `workflow` scopes |
| `GITHUB_BUILD_REPO` | `your-username/smartapp-builder` |
| `GITHUB_WEBHOOK_SECRET` | Any random 32+ char string — **must match what's passed to the workflow** (it already does, the trigger function forwards this exact secret) |

### 5. Test
Open SmartApp → any project → click **Build APK** → watch the live timeline.
The first run typically takes 5–6 min (Gradle cold cache); subsequent runs ~3 min.

---

## File map

```
.github/workflows/build-apk.yml   ← the build pipeline
scripts/notify.sh                 ← posts step progress back to Supabase
scripts/inject-files.js           ← downloads the project snapshot
scripts/patch-android.js          ← rewrites package id / app name / version
template/                         ← Vite + React + Capacitor scaffold (you create this)
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Resource not accessible by integration` on release | Enable "Read and write permissions" in repo Actions settings |
| `npm ci` fails | Make sure `template/package-lock.json` is committed |
| APK builds but webhook never fires | Confirm `GITHUB_WEBHOOK_SECRET` is identical on both sides |
| Build stuck at "Queued" | Check that the workflow file is on `main` branch and the PAT has `workflow` scope |
| Future iOS support | Add a `build-ipa.yml` workflow on `macos-latest` runner with `gradle` → `xcodebuild` |

