#!/usr/bin/env bash
# Keeps the free Supabase project from pausing, and self-heals if it does.
#  1. Ping: keepalive_ping() RPC = real write + reads (falls back to a plain
#     REST read if migration 005 isn't applied yet).
#  2. If the project is unreachable/paused and SUPABASE_ACCESS_TOKEN is set,
#     restore it through the Management API and wait until it is healthy.
set -uo pipefail

REF="aqwukyaeiirwcajqdlda"
URL="https://${REF}.supabase.co"
KEY="sb_publishable_qnayXwSoPUz0ozWeX1HkbQ_cTViyoAz"   # public client key (RLS-guarded)
MGMT="https://api.supabase.com/v1/projects/${REF}"

ping_db() {
  local code
  code=$(curl -sS -o /tmp/ping.json -w '%{http_code}' --max-time 30 -X POST \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
    -d '{}' "$URL/rest/v1/rpc/keepalive_ping") || code=000
  if [ "$code" = "200" ]; then
    echo "heartbeat ok: $(cat /tmp/ping.json)"; return 0
  fi
  if [ "$code" = "404" ]; then   # function missing -> old-style read
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
      "$URL/rest/v1/profiles?select=id&limit=1") || code=000
    [ "$code" = "200" ] && { echo "fallback read ok (apply migration 005!)"; return 0; }
  fi
  echo "ping failed (HTTP $code)"; return 1
}

project_status() {
  curl -sS --max-time 30 -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "$MGMT" \
    | sed -n 's/.*"status":"\([A-Z_]*\)".*/\1/p'
}

# Verify the auto-restore token on every healthy run, so an expired/revoked
# token fails loudly now (GitHub emails) instead of silently at the next pause.
check_token() {
  if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
    echo "::warning::No SUPABASE_ACCESS_TOKEN secret — auto-restore is disabled."
    return 0
  fi
  local status
  status=$(project_status)
  if [ -z "$status" ]; then
    echo "::error::SUPABASE_ACCESS_TOKEN is invalid or expired — auto-restore would fail. Create a new token at https://supabase.com/dashboard/account/tokens and update the repo secret."
    return 1
  fi
  echo "auto-restore armed (management API sees project as $status)"
}

for attempt in 1 2 3; do
  if ping_db; then
    check_token
    exit $?
  fi
  sleep 20
done

echo "::warning::Supabase project looks paused or down."
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "::error::No SUPABASE_ACCESS_TOKEN secret — cannot auto-restore. Resume it at https://supabase.com/dashboard/project/${REF}"
  exit 1
fi

status=$(project_status)
echo "management API status: ${status:-unknown}"
if [ "$status" = "INACTIVE" ]; then
  echo "restoring project…"
  curl -sS --max-time 60 -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "$MGMT/restore"; echo
fi

# wait up to ~15 min for it to come back, then ping for real
for i in $(seq 1 30); do
  sleep 30
  status=$(project_status)
  echo "[$i] status: ${status:-unknown}"
  if [ "$status" = "ACTIVE_HEALTHY" ] && ping_db; then
    echo "::notice::Supabase project was paused and has been auto-restored."
    exit 0
  fi
done
echo "::error::Project did not come back — check the dashboard."
exit 1
