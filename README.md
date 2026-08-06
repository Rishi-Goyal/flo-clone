# Bloom 🌸

A personal cycle-tracking PWA (Flo alternative) for two people: the person tracking their cycle, and
their partner — who gets a live dashboard with the current phase, days until the next period, and a
daily tip on how to be supportive.

**What it does differently from Flo:**

- **Fully customisable tracking** — add, rename, reorder, hide, and restyle anything you log.
  Six input types: yes/no, 1–N scale, single choice, multi choice, number, free text.
- **Partner sync with real privacy controls** — your partner has their own account and only ever sees
  what you share. Sharing is enforced by Postgres row-level security, not just hidden in the UI.
- **Honest predictions** — a rolling average over your last 6 cycles with an uncertainty window and a
  confidence level, so irregular cycles show a date *range*, never a fake-precise date.

## Stack

React 18 + TypeScript + Vite · Tailwind CSS 4 · TanStack Query · Supabase (Postgres, magic-link auth,
RLS, realtime) · vite-plugin-pwa · Vitest

## Setup (one time, ~10 minutes)

### 1. Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard, open **SQL Editor** and run the whole of
   [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
3. In **Authentication → URL Configuration**, add your dev and production URLs
   (e.g. `http://localhost:5173` and your Vercel URL) to the redirect allow-list.

> Note: Supabase's built-in email service is rate-limited (~4 magic-link emails/hour). Fine for two
> people; add a custom SMTP provider in Auth settings if you ever hit it.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**.

### 3. Run

```bash
npm install
npm run dev
```

Sign in with your email (magic link), choose **"I track my cycle"**, and you're off.

### 4. Deploy (needed for phone install)

Push to GitHub and import into [Vercel](https://vercel.com) (framework: Vite). Add the two `VITE_*`
env vars in the Vercel project settings. PWAs require HTTPS, so install the app on your phones from
the deployed URL: **Share → Add to Home Screen** (iOS) or the install prompt (Android).

## Linking your partner

1. You: **Settings → Partner → Generate invite code**, then share the code or link.
2. Partner: opens the link (or signs up and enters the code during onboarding).
3. You control what they see in **Settings → Sharing** — phase/tips, predictions, exact dates,
   and per-tracker symptom sharing. Every switch takes effect in their app instantly.

## Sample data (optional)

To preview the calendar/insights with ~6 months of realistic data:

1. Complete onboarding in the app first.
2. Add `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API) and `SEED_EMAIL` to `.env.local`.
3. `npm run seed`

## Android app

The repo doubles as a native Android app via [Capacitor](https://capacitorjs.com) (`android/`).

**Get an APK without installing anything:** every push to GitHub runs the *Android APK* workflow,
which builds `bloom-debug-apk` as a downloadable artifact (Actions tab → latest run → Artifacts).
Download it on the phone and install (allow "install unknown apps" when prompted).

**Sign-in on Android:** magic links open in the phone's browser, not the app — so the login screen
also accepts the **6-digit code** included in the sign-in email. Enter email → "Send sign-in link" →
type the code from the email.

**Local build** (only if you have Android Studio / an Android SDK):

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug   # → android/app/build/outputs/apk/debug/app-debug.apk
```

Client config for these builds comes from `.env.production` (public URL + publishable key — safe to
commit; everything is enforced by RLS).

## Note notifications (FCM) — live

When one partner sends a note, the other gets a native Android push, even with the app
closed. Pipeline:

```
partner_notes INSERT → trigger (pg_net) → notify-note Edge Function → FCM → device
```

Already provisioned: Firebase project `bloom-6dd73` (Android app `com.rishi.bloom`,
`android/app/google-services.json` committed — it's client config, not a secret), the
`push_tokens` table, the deployed `notify-note` function with its `FCM_SERVICE_ACCOUNT`
and `NOTE_WEBHOOK_SECRET` secrets, and the `partner_notes_notify` trigger.

The app registers its device token after sign-in (Android asks permission on first
launch) and the function deletes tokens FCM reports as dead. On web, push registration
no-ops — notes still appear as an in-app banner.

### Managing Supabase from the CLI

The dashboard's SQL editor is awkward to automate, so migrations and functions go through
the CLI/Management API using a personal access token in `.env.local`
(`SUPABASE_ACCESS_TOKEN`, created at Account → Access Tokens; revoke anytime):

```bash
npx supabase functions deploy notify-note --no-verify-jwt --project-ref aqwukyaeiirwcajqdlda
npx supabase secrets set --env-file <file> --project-ref aqwukyaeiirwcajqdlda
```

Migrations in `supabase/migrations/` are applied by POSTing the SQL to
`https://api.supabase.com/v1/projects/<ref>/database/query` with that token.

## Development

```bash
npm test          # unit tests for prediction/insights/tips logic
npm run build     # type-check + production build
npm run preview   # serve the production build locally
```

### Test accounts (dev login)

With `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`:

```bash
npm run dev:login
```

creates/refreshes two linked fixtures — `tracker@bloom.test` (seeded with ~5 cycles of data) and
`partner@bloom.test` — and prints single-use sign-in URLs handled by the dev-only `/dev-login`
route. Open a URL to jump straight into that role, no email round-trip. The route only exists in
`npm run dev` builds; add `--reseed` to regenerate log data.

### Verifying the privacy model (RLS)

Sign in as the partner in an incognito window and check that:

- With **Symptoms & mood** off, the partner sees no logs (the queries return zero rows — blocked by
  the database, not the UI).
- Toggling a share switch on the tracker account updates the partner dashboard live, no refresh.
- With **Cycle phase** off, the partner sees "Nothing shared right now".

## Notes & roadmap

- Fertile-window/ovulation figures are calendar estimates — **not** contraception-grade.
- Reminders currently surface as banners on the Today screen. Web push (via Supabase Edge Functions +
  VAPID) is the planned next step; the service worker is already in place.
- Cycle predictions: rolling mean of the last 6 valid cycles (15–60 days), ±stddev-based window,
  ovulation at predicted-start − 14 days. See [`src/lib/cycle.ts`](src/lib/cycle.ts).
