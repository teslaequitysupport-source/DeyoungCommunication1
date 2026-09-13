#!/usr/bin/env bash
# Full-surface probe: every endpoint the browser touches, in the exact states
# the browser produces them (anon / authed USER / ADMIN). Prints status + first
# bytes for each. Probe users are cascade-deleted at the end.
# Usage: scripts/probe-all.sh <base-url>
set -u
BASE="${1:-http://127.0.0.1:3998}"
STAMP="$(date +%s)"
EMAIL="e2e-all-${STAMP}@voxcore-probe.invalid"
PW="ProbePass123x"
JAR="$(mktemp)"
AJAR="$(mktemp)"
PASS=0; FAIL=0
declare -a FAILURES

# name, method, path, expected-status, extra-curl-args...
hit() {
  local name="$1" method="$2" path="$3" want="$4"; shift 4
  local out status body
  out=$(curl -s -m 30 -w $'\n%{http_code}' -X "$method" "$BASE$path" "$@" 2>&1)
  status=$(echo "$out" | tail -1)
  body=$(echo "$out" | head -n -1)
  if [ "$status" = "$want" ]; then
    echo "PASS [$status] $name"
    PASS=$((PASS+1))
    LAST_BODY="$body"
    return 0
  else
    echo "FAIL [$status want $want] $name"
    echo "  body: $(echo "$body" | head -c 300)"
    FAIL=$((FAIL+1)); FAILURES+=("$name ($status want $want)")
    LAST_BODY="$body"
    return 1
  fi
}

echo "=== ANON SURFACE ==="
hit "HTML page /"              GET  "/"                    200 -H "Origin: $BASE"
hit "health"                   GET  "/api/health"          200
hit "public/config"            GET  "/api/public/config"   200
hit "public/limits"            GET  "/api/public/limits"   200
hit "billing/plans"            GET  "/api/billing/plans"   200
hit "models catalog"           GET  "/api/models"          200
hit "operator/brief anon 401"  GET  "/api/operator/brief"  401

echo "=== REGISTER + VERIFY ==="
REG=$(curl -s -m 30 -c "$JAR" -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' -H "Origin: $BASE" -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"acceptTerms\":true}")
if echo "$REG" | grep -q '"ok":true'; then echo "PASS register"; PASS=$((PASS+1)); else echo "FAIL register: $(echo "$REG" | head -c 300)"; FAIL=$((FAIL+1)); FAILURES+=("register"); fi
TOKEN=$(echo "$REG" | sed -n 's/.*"devVerificationToken":"\([^"]*\)".*/\1/p')
hit "verify-email"             POST "/api/auth/verify-email" 200 -b "$JAR" -H 'Content-Type: application/json' -H "Origin: $BASE" -d "{\"token\":\"$TOKEN\"}"

echo "=== AUTHED USER SURFACE ==="
hit "auth/me"                  GET  "/api/auth/me"          200 -b "$JAR"
hit "billing/overview"         GET  "/api/billing/overview" 200 -b "$JAR"
hit "billing/usage"            GET  "/api/billing/usage"    200 -b "$JAR"
hit "sessions list"            GET  "/api/sessions"         200 -b "$JAR"
hit "models/mine"              GET  "/api/models/mine"      200 -b "$JAR"
hit "notifications"            GET  "/api/notifications"    200 -b "$JAR"
hit "support tickets list"     GET  "/api/support/tickets"  200 -b "$JAR"
hit "auth/sessions devices"    GET  "/api/auth/sessions"    200 -b "$JAR"
hit "start session (no model)" POST "/api/sessions"         409 -b "$JAR" -H 'Content-Type: application/json' -H "Origin: $BASE" -d "{\"modelId\":\"00000000-0000-0000-0000-000000000000\",\"requestedTier\":\"DSP_CPU\"}"
hit "create ticket"            POST "/api/support/tickets"   200 -b "$JAR" -H 'Content-Type: application/json' -H "Origin: $BASE" -d '{"subject":"Probe ticket","body":"Automated probe - safe to delete","category":"GENERAL"}'

echo "=== FRESH LOGIN ==="
hit "login fresh"              POST "/api/auth/login"        200 -c "$JAR" -H 'Content-Type: application/json' -H "Origin: $BASE" -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}"

echo "=== ADMIN SURFACE (temp admin) ==="
bun scripts/make-brief-admin.ts >/dev/null 2>&1
hit "login admin"              POST "/api/auth/login"        200 -c "$AJAR" -H 'Content-Type: application/json' -H "Origin: $BASE" -d '{"email":"brief-admin-probe@voxcore-probe.invalid","password":"BriefProbe-2026!x"}'
hit "operator/brief admin"     GET  "/api/operator/brief"    200 -b "$AJAR"
hit "admin/overview"           GET  "/api/admin/overview"    200 -b "$AJAR"
hit "admin/users"              GET  "/api/admin/users"       200 -b "$AJAR"

echo ""
echo "RESULT: PASS=$PASS FAIL=$FAIL"
if [ ${#FAILURES[@]} -gt 0 ]; then printf '  failed: %s\n' "${FAILURES[@]}"; fi

# cleanup probe users (cascade)
bun scripts/cleanup-probe.ts >/dev/null 2>&1 || true
echo "probe users cleaned"
[ "$FAIL" -eq 0 ]
