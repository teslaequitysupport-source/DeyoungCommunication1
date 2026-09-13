#!/usr/bin/env bash
# Full real-time conversion E2E: proves "voice conversion works in real time"
# through the REAL production path against the REAL database:
#   boot server -> temp admin -> provision LOCAL worker (spawned python agent)
#   -> agent registers -> probe user starts a session -> scheduler assigns
#   -> gateway pairs -> 30 PCM chunks streamed -> converted audio returns
#   -> RTT measured. Everything is cleaned up afterwards.
# Prereqs: python3 with requirements.txt deps installed, DATABASE_URL exported.
set -u
cd "$(dirname "$0")/.."
BASE="http://127.0.0.1:3998"
PORT=3998
EMAIL="e2e-probe-$(date +%s)@voxcore-probe.invalid"
PW="ProbePass123x"
ADMIN_EMAIL="e2e-admin@voxcore-probe.invalid"
ADMIN_PW="AdminProbe123x"
USER_JAR="/tmp/e2e-user.jar"
ADMIN_JAR="/tmp/e2e-admin.jar"
PASS=0; FAIL=0
check() { if echo "$2" | grep -q "$3"; then echo "PASS $1"; PASS=$((PASS+1)); else echo "FAIL $1: $(echo "$2" | head -c 300)"; FAIL=$((FAIL+1)); fi; }

echo "=== 1. boot server ==="
NODE_ENV=production PORT=$PORT timeout 300 bun scripts/boot.ts > /tmp/e2e-boot.log 2>&1 &
BOOT_PID=$!
for i in $(seq 1 40); do
  sleep 2
  curl -s -m 2 "$BASE/api/health" | grep -q '"ok":true' && break
done
H=$(curl -s -m 5 "$BASE/api/health")
check "server healthy" "$H" '"status":"ok"'

echo "=== 2. temp admin (deleted afterwards) ==="
bun -e '
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
const email = "e2e-admin@voxcore-probe.invalid";
const hash = await bcrypt.hash("AdminProbe123x", 10);
const u = await db.user.upsert({
  where: { email },
  update: { role: "ADMIN", passwordHash: hash, status: "ACTIVE", emailVerifiedAt: new Date() },
  create: { email, passwordHash: hash, role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
});
console.log("admin:" + u.id);
await db.$disconnect();' > /tmp/e2e-admin.log 2>&1
check "admin created" "$(cat /tmp/e2e-admin.log)" "admin:"

echo "=== 3. admin login + provision LOCAL worker (real python agent spawn) ==="
curl -s -m 10 -c "$ADMIN_JAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PW\"}" > /dev/null
PROV=$(curl -s -m 20 -b "$ADMIN_JAR" -X POST "$BASE/api/admin/workers/provision" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d '{"providerCode":"LOCAL","tier":"DSP_CPU","name":"e2e-local"}')
check "provision LOCAL accepted" "$PROV" '"ok":true'
WORKER_ID=$(echo "$PROV" | sed -n 's/.*"workerId":"\([^"]*\)".*/\1/p')
echo "worker: $WORKER_ID"

echo "=== 4. wait for agent registration (real python process -> backend) ==="
STATUS=""
for i in $(seq 1 20); do
  sleep 2
  STATUS=$(curl -s -m 5 -b "$ADMIN_JAR" "$BASE/api/admin/workers" | python3 -c "
import json,sys
d = json.load(sys.stdin)
ws = d.get('workers', d if isinstance(d, list) else [])
w = [x for x in ws if x.get('id') == '$WORKER_ID']
print(w[0].get('status','?') if w else 'missing')" 2>/dev/null || echo "poll-error")
  echo "  worker status: $STATUS"
  [ "$STATUS" = "READY" ] || [ "$STATUS" = "REGISTERED" ] || [ "$STATUS" = "IDLE" ] && break
  [ "$STATUS" = "FAILED" ] && break
done
check "agent registered with backend (BACKEND_URL=$PORT fix)" "$STATUS" "READY\|REGISTERED\|IDLE"
if [ "$STATUS" = "FAILED" ]; then
  echo "--- worker lastError ---"
  curl -s -m 5 -b "$ADMIN_JAR" "$BASE/api/admin/workers" | python3 -c "
import json,sys
d = json.load(sys.stdin)
ws = d.get('workers', d if isinstance(d, list) else [])
w = [x for x in ws if x.get('id') == '$WORKER_ID']
print(w[0].get('lastError','?') if w else 'missing')"
fi

echo "=== 5. probe user registers and verifies ==="
REG=$(curl -s -m 15 -c "$USER_JAR" -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"acceptTerms\":true}")
TOKEN=$(echo "$REG" | sed -n 's/.*"devVerificationToken":"\([^"]*\)".*/\1/p')
check "user registered" "$REG" '"ok":true'
curl -s -m 10 -b "$USER_JAR" -X POST "$BASE/api/auth/verify-email" \
  -H 'Content-Type: application/json' -H "Origin: $BASE" -d "{\"token\":\"$TOKEN\"}" > /dev/null

echo "=== 6. REAL-TIME conversion: 30 PCM chunks through gateway + agent ==="
E2E_BASE="$BASE" USER_JAR="$USER_JAR" timeout 60 bun scripts/e2e-audio.ts 2>&1 | tee /tmp/e2e-audio.log
check "AUDIO FLOW VERIFIED (30/30 chunks)" "$(cat /tmp/e2e-audio.log)" "AUDIO FLOW VERIFIED"

echo "=== 7. cleanup ==="
bun scripts/cleanup-probe.ts 2>&1 | tail -2
bun -e '
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const w = await db.worker.findUnique({ where: { id: process.argv[1] } });
if (w) {
  await db.workerEvent.deleteMany({ where: { workerId: w.id } });
  await db.commandQueueEntry?.deleteMany?.({ where: { workerId: w.id } }).catch?.(() => {});
  await db.worker.delete({ where: { id: w.id } });
  console.log("worker deleted");
} else console.log("worker not found");
const a = await db.user.findUnique({ where: { email: "e2e-admin@voxcore-probe.invalid" } });
if (a) { await db.user.delete({ where: { id: a.id } }); console.log("admin deleted"); }
await db.$disconnect();' "$WORKER_ID" 2>&1 | tail -2
pkill -f worker_agent.py 2>/dev/null && echo "agent process killed" || echo "agent already gone"
kill $BOOT_PID 2>/dev/null; echo "server stopped"
echo "=== E2E RESULT: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
