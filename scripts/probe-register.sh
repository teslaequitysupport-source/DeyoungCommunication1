#!/usr/bin/env bash
# End-to-end registration probe: runs the EXACT browser flow against a running
# server (register -> session cookie -> me -> verify -> me ACTIVE -> login).
# Uses a clearly-marked probe address and deletes the user afterwards
# (all User relations are onDelete: Cascade, so one delete cleans up).
# Usage: scripts/probe-register.sh <base-url>
set -u
BASE="${1:-http://127.0.0.1:3998}"
EMAIL="e2e-probe-$(date +%s)@voxcore-probe.invalid"
PW="ProbePass123x"
JAR="$(mktemp)"
PASS=0; FAIL=0

check() { # name, actual, expected-substring
  if echo "$2" | grep -q "$3"; then echo "PASS $1"; PASS=$((PASS+1));
  else echo "FAIL $1"; echo "  got: $(echo "$2" | head -c 400)"; echo "  want substring: $3"; FAIL=$((FAIL+1)); fi
}

# 0. Public config: registration open, google state visible
CFG=$(curl -s -m 10 "$BASE/api/public/config")
check "public/config registrationEnabled true" "$CFG" '"registrationEnabled":true'

# 1. Register exactly like the browser (JSON + Origin header + cookie jar)
REG=$(curl -s -m 20 -c "$JAR" -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"acceptTerms\":true}")
check "register returns ok" "$REG" '"ok":true'
TOKEN=$(echo "$REG" | sed -n 's/.*"devVerificationToken":"\([^"]*\)".*/\1/p')
if [ -n "$TOKEN" ]; then echo "PASS register exposes dev verification token (EMAIL_MODE=none)"; PASS=$((PASS+1));
else echo "FAIL no devVerificationToken in register response"; FAIL=$((FAIL+1)); fi

# 2. Session cookie works: /api/auth/me shows the pending user
ME1=$(curl -s -m 10 -b "$JAR" "$BASE/api/auth/me")
check "me returns the new user" "$ME1" "$EMAIL"
check "me status PENDING_VERIFICATION" "$ME1" '"status":"PENDING_VERIFICATION"'

# 3. Verify with the dev token
VER=$(curl -s -m 10 -b "$JAR" -X POST "$BASE/api/auth/verify-email" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d "{\"token\":\"$TOKEN\"}")
check "verify-email ok" "$VER" '"verified":true'

# 4. Me is now ACTIVE
ME2=$(curl -s -m 10 -b "$JAR" "$BASE/api/auth/me")
check "me status ACTIVE after verify" "$ME2" '"status":"ACTIVE"'

# 5. Fresh login with the same credentials (new cookie jar)
JAR2="$(mktemp)"
LOG=$(curl -s -m 10 -c "$JAR2" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
check "login ok" "$LOG" '"ok":true'

# 6. CSRF guard still does its job: cross-origin POST must be rejected
CSR=$(curl -s -m 10 -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: https://evil.example" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
check "cross-origin POST rejected (403)" "$CSR" "403"

# 7. Wrong password rejected
BAD=$(curl -s -m 10 -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPass999\"}")
check "wrong password rejected (401)" "$BAD" "401"

# 8. Cleanup: remove the probe user (cascades session/consent/subscription/notification/token)
CLEAN=$(bun "$(cd "$(dirname "$0")" && pwd)/cleanup-probe.ts" 2>&1 | tail -1)
check "probe user cleaned up" "$CLEAN" "deleted"

rm -f "$JAR" "$JAR2"
echo "=== $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
