#!/usr/bin/env bash
# Boot production server against production Supabase and hammer every public
# endpoint + the register/verify/login flow. One command: background processes
# do not survive between tool calls in this sandbox.
set -u
cd /home/z/my-project

PORT=3998
export NODE_ENV=production
export PORT=$PORT
# .env already carries the encoded Supabase URL; boot.ts will re-verify.
set -a; source .env; set +a
export DATABASE_URL

echo "== boot =="
bun scripts/boot.ts > /tmp/vox-probe-boot.log 2>&1 &
BOOT_PID=$!

for i in $(seq 1 60); do
  sleep 1
  if curl -sf "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then break; fi
  if ! kill -0 $BOOT_PID 2>/dev/null; then echo "BOOT DIED"; tail -30 /tmp/vox-probe-boot.log; exit 1; fi
done

echo "== GET endpoints =="
for ep in /api/health /api/public/config /api/public/limits /api/models /api/billing/plans /api/auth/me /api/operator/brief /api/sessions /api/billing/overview /api/notifications; do
  code=$(curl -s -o /tmp/vox-resp.json -w '%{http_code}' "http://127.0.0.1:$PORT$ep")
  echo "$code $ep"
  if [ "$code" = "500" ]; then echo "--- 500 BODY:"; cat /tmp/vox-resp.json; echo; fi
done

echo "== register flow =="
TS=$(date +%s)
EMAIL="probe-$TS@voxcore-probe.invalid"
REG=$(curl -s -X POST "http://127.0.0.1:$PORT/api/auth/register" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Probe-T3st!x\",\"name\":\"Probe\",\"acceptTerms\":true}")
echo "register: $REG" | head -c 400; echo
TOKEN=$(echo "$REG" | grep -o '"devVerificationToken":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then
  V=$(curl -s -X POST "http://127.0.0.1:$PORT/api/auth/verify" -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}")
  echo "verify: $V" | head -c 200; echo
fi
LOGIN=$(curl -s -c /tmp/vox-cookies.txt -X POST "http://127.0.0.1:$PORT/api/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Probe-T3st!x\"}")
echo "login: $LOGIN" | head -c 300; echo
ME=$(curl -s -b /tmp/vox-cookies.txt "http://127.0.0.1:$PORT/api/auth/me")
echo "me(authed): $(echo $ME | head -c 300)"; echo

echo "== authed GETs =="
for ep in /api/sessions /api/billing/overview /api/models /api/notifications; do
  code=$(curl -s -b /tmp/vox-cookies.txt -o /tmp/vox-resp.json -w '%{http_code}' "http://127.0.0.1:$PORT$ep")
  echo "$code $ep (authed)"
  if [ "$code" = "500" ]; then echo "--- 500 BODY:"; cat /tmp/vox-resp.json; echo; fi
done

echo "== cleanup =="
bun scripts/cleanup-probe.ts 2>&1 | tail -2

kill $BOOT_PID 2>/dev/null
echo "== boot log errors (if any) =="
grep -i "unhandled_route_error\|error" /tmp/vox-probe-boot.log | grep -v "rate_limit" | tail -10
echo DONE
