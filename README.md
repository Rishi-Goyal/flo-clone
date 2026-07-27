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

## Development

```bash
npm test          # unit tests for prediction/insights/tips logic
npm run build     # type-check + production build
npm run preview   # serve the production build locally
```

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
