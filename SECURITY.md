# Bloom — security model and analysis

*Last reviewed: 29 July 2026 (full-system pass).*

Bloom handles intimate health data, so the standing rule is: **the database, not the UI,
is the privacy boundary.** Anything the UI merely hides must be assumed visible to a
technical user with their own JWT.

## Architecture and transport

- Clients (web/PWA and the Capacitor Android app) talk **only** to Supabase over
  HTTPS/WSS (TLS), plus a read-only HTTPS call to GitHub's public releases API for the
  update banner. There is no server of our own and no third-party analytics.
- Android: cleartext traffic is off (platform default), `allowMixedContent` is false,
  and `allowBackup` is **false** (an ADB/cloud backup can no longer lift the WebView
  storage, which contains session tokens).
- Data at rest is encrypted by Supabase (AES-256 at the storage layer).

## Authentication

- **Passwordless**: magic links / OTP codes only; no password database exists to leak.
- **PKCE flow everywhere.** On Android the magic link redirects to the
  `com.rishi.bloom://login-callback` deep link. Custom schemes can in principle be
  claimed by other apps, but the PKCE code is useless without the in-app verifier —
  a hijacking app cannot complete the exchange.
- Sessions are supabase-js JWTs in `localStorage`/WebView storage. Acceptable because
  the app loads no third-party scripts and React escapes all rendered content
  (no `dangerouslySetInnerHTML` anywhere; partner-note bodies render as text).
- The `/dev-login` test route is compiled out of production builds
  (`import.meta.env.DEV` guard); the fixture script requires the local secret key.

## Authorization — row-level security

Every table has RLS enabled; owners get `user_id = auth.uid()` policies. Partner access:

| Table | Partner can… | Gate |
|---|---|---|
| `cycle_stats` | nothing directly (since migration 003) | reads go through `get_partner_stats()` |
| `log_entries` | SELECT | `share_logs` **and** per-tracker `shared_with_partner` (+ `share_notes` for text) |
| `trackers`, `tracker_categories` | SELECT shared ones | `share_logs` |
| `partner_links` | SELECT own link; UPDATE only `status → revoked` | trigger blocks any other change (sharing flags stay owner-only) |
| `partner_notes` | INSERT to their counterpart; SELECT own; mark `read_at` | membership in the **active** link checked at insert; trigger restricts updates to `read_at` |
| `profiles` | SELECT display name | active link only |

Hardening details:

- All `SECURITY DEFINER` functions pin `search_path = public`.
- `partner_can_view()` validates the flag name against an allowlist before the dynamic
  `%I` interpolation — no injection path.
- Invite codes are claimed via the `accept_invite()` RPC; no SELECT policy exists on
  pending links, so codes can't be enumerated. Codes are 8 hex chars (~4.3 billion),
  callable by authenticated users only.
- **Migration 003** closed the one real gap found in this review: partners could
  previously SELECT the whole `cycle_stats` row whenever `share_phase` was on, so the
  *Predictions* and *Period dates* toggles were UI-only. Partners now call
  `get_partner_stats()`, which filters fields by the owner's flags inside the database
  and computes day-relative values server-side so hidden dates never leave Postgres.
  Realtime still works via a `stats_updated_at` "ping" on the partner-visible link row.

Verified empirically with the test fixtures: unshared queries return zero rows (not
errors), flag flips propagate live, and the note-guard trigger rejects body edits.

## Secrets

- The **publishable** key and project URL are committed intentionally — they are the
  client credential and safe by design; RLS is the boundary.
- The **secret** key lives only in the gitignored `.env.local` (verified never
  committed across the full git history) and is used only by local dev scripts.
- The keep-alive's `SUPABASE_ACCESS_TOKEN` is a GitHub **repository secret** (masked in
  logs, unavailable to forked PRs). It can restore/manage the project, so if it ever leaks,
  revoke it at supabase.com/dashboard/account/tokens.
- `keepalive_ping()` is callable with the public key by design: it only bumps a one-row
  heartbeat counter and returns its timestamp — no user data in or out, bounded storage.
- The **home-screen widget** stores only a derived snapshot (dates/phase, partner's display
  name) in app-private SharedPreferences, excluded from backups (`allowBackup=false`). It
  makes no network calls and is blanked on sign-out. Note it is visible to anyone looking
  at the unlocked home screen — remove the widget if that matters.

## Accepted risks and operator checklist

1. **Public sign-ups are open** (highest-value action): anyone who finds the project
   URL can create an account. RLS stops them reading anyone's data, but junk accounts
   could consume free-tier quota. Once both real accounts exist, turn off
   **Authentication → Sign In / Providers → Allow new users to sign up**. The dev
   fixture script keeps working (it uses the admin API).
2. **Update supply chain**: the APK update banner trusts GitHub releases on
   `Rishi-Goyal/flo-clone`. Keep 2FA on the GitHub account; the APK is debug-signed,
   so Android will not stop a look-alike replacing it — only install from the releases
   page.
3. **Backups**: the free tier has no point-in-time recovery. Export occasionally if
   the history matters (`Database → Backups` or `pg_dump`).
4. If you ever suspect the laptop was compromised, roll the secret key in
   **Settings → API Keys** and update `.env.local`; nothing else holds it.
5. When the web app gets deployed (Vercel), add CSP and HSTS headers at the edge.
6. Supabase magic-link emails go through Supabase's shared SMTP until custom SMTP is
   configured — fine for two users, but the sender domain isn't yours.
