# SWARAJ — Play Store Release Instructions

Everything in this file runs from the **project root** (`Swaraj/`) unless stated otherwise.

---

## Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Node.js | 18+ | `node -v` |
| Java (JDK) | 17 or 21 | `java -version` |
| Android SDK | API 36 (Android 16) | Android Studio SDK Manager |
| Gradle | Bundled via wrapper | `android/gradlew --version` |

---

## Step 1 — Create a release keystore (one-time only)

Run this once. Keep the `.jks` file and passwords somewhere safe (password manager).
A lost keystore means you can never update the app on the Play Store.

```bash
keytool -genkey -v \
  -keystore android/swaraj-release.jks \
  -alias swaraj \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

You will be prompted for:
- Store password (remember it)
- Key password (remember it, can be same as store password)
- Your name / organisation / location details

---

## Step 2 — Create android/keystore.properties

Copy the template and fill in your real values:

```bash
copy android\keystore.properties.template android\keystore.properties
```

Edit `android/keystore.properties`:

```properties
storeFile=swaraj-release.jks
storePassword=<your store password>
keyAlias=swaraj
keyPassword=<your key password>
```

`keystore.properties` and `swaraj-release.jks` are both gitignored — they will never be committed.

---

## Step 3 — Build the web assets

```bash
npm run build
```

Output lands in `dist/`. Verify it exists before continuing.

---

## Step 4 — Sync web assets to Android

```bash
npx cap sync android
```

This copies `dist/` into `android/app/src/main/assets/public/` and regenerates
`capacitor.config.json`. Run this every time you change web code.

---

## Step 5 — Generate the signed release AAB

```bash
cd android
gradlew bundleRelease
```

On macOS/Linux use `./gradlew bundleRelease`.

The AAB will be written to:

```
android/app/build/outputs/bundle/release/app-release.aab
```

To verify it is signed:

```bash
cd android
gradlew signingReport
```

---

## Step 6 — Upload to Google Play Console

1. Go to [play.google.com/console](https://play.google.com/console)
2. Select your app (or create a new one with package ID `com.swaraj.realestate`)
3. Navigate to **Release → Production** (or Internal Testing for first upload)
4. Click **Create new release**
5. Upload `android/app/build/outputs/bundle/release/app-release.aab`
6. Fill in release notes, then **Review release → Start rollout**

---

## Repeat release checklist (every update)

- [ ] Increment `versionCode` by 1 in `android/app/build.gradle` (Play Store rejects duplicate codes)
- [ ] Update `versionName` to match (e.g. `"1.1"`)
- [ ] Run `npm run build`
- [ ] Run `npx cap sync android`
- [ ] Run `cd android && gradlew bundleRelease`
- [ ] Upload new `.aab` to Play Console

---

## App identity summary

| Field | Value |
|---|---|
| Application ID | `com.swaraj.realestate` |
| App name | SWARAJ |
| versionCode | 1 |
| versionName | 1.0 |
| minSdkVersion | 24 (Android 7.0) |
| targetSdkVersion | 36 (Android 16) |
| compileSdkVersion | 36 |
| Supabase project | `ynbqncqiodnauyujbpux.supabase.co` |

---

## Important security notes

- The Supabase anon key is baked into the JS bundle at build time — this is standard
  practice. Protect your data with Supabase **Row Level Security (RLS)** policies.
- Never commit `keystore.properties` or `*.jks` / `*.keystore` files to source control.
- The app enforces HTTPS-only traffic via `network_security_config.xml`.
