#!/bin/bash
# VOXCORE E2E VERIFICATION ORCHESTRATOR
# Runs the full remaining verification suite inside one shell session:
# dev server -> fresh worker agent -> FAILOVER -> RATE_LIMIT -> SCALE_TO_ZERO.
# Background processes only survive inside a single tool call in this sandbox,
# which is why the sequence is one block.
set -u
cd /home/z/my-project

# 1. Dev server
nohup bun run dev > /home/z/my-project/.zscripts/dev.log 2>&1 &
DEVPID=$!
C=000
for i in $(seq 1 20); do
  sleep 2
  C=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/models --max-time 3)
  [ "$C" = "200" ] && break
done
echo "[1] dev server: HTTP $C"
if [ "$C" != "200" ]; then tail -5 .zscripts/dev.log; exit 1; fi

# 2. Fresh worker agent (old agent's heartbeat loop is wedged after backend restarts)
OLD=$(ps aux | grep worker_agent.py | grep -v grep | awk '{print $2}')
[ -n "$OLD" ] && kill $OLD 2>/dev/null
rm -f worker-agent/agent.log
ADMIN_COOKIE="voxcore_session=$(grep voxcore_session /tmp/admin.jar | awk '{print $NF}')"
PROV=$(curl -s -X POST http://127.0.0.1:3000/api/admin/workers/provision \
  -H "content-type: application/json" -b "$ADMIN_COOKIE" \
  -d '{"providerCode":"LOCAL","tier":"DSP_CPU","name":"local-agent-5"}')
echo "[2] provision: $(echo "$PROV" | head -c 120)"
sleep 12
AGENT_STATUS=$(bun -e "
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const w = await db.worker.findFirst({ where: { name: 'local-agent-5' } });
console.log(w ? w.status : 'MISSING');
await db.\$disconnect();" 2>/dev/null)
echo "[2] local-agent-5 status: $AGENT_STATUS"

# 3. Cleanup stale sessions
bun scripts/cleanup-stale.ts 2>&1 | tail -1

# 4. FAILOVER (drains a live worker with a TEST session; maintenance recovers)
echo "[3] FAILOVER:"
timeout 200 bun scripts/verify-failover.ts 2>&1 | grep -vE "^$" | tail -9

# 5. RATE_LIMIT
echo "[4] RATE_LIMIT:"
curl -s -X POST http://127.0.0.1:3000/api/admin/testlab \
  -H "content-type: application/json" -b "$ADMIN_COOKIE" \
  -d '{"kind":"RATE_LIMIT","burst":300}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('result', d), indent=None)[:400])"

# 6. SCALE_TO_ZERO
echo "[5] SCALE_TO_ZERO:"
curl -s -X POST http://127.0.0.1:3000/api/admin/testlab \
  -H "content-type: application/json" -b "$ADMIN_COOKIE" \
  -d '{"kind":"SCALE_TO_ZERO"}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('result', d), indent=None)[:400])"

# 7. Admin-managed gateway status (control-plane managed service probe)
echo "[6] GATEWAY service status:"
curl -s http://127.0.0.1:3000/api/admin/services/gateway -b "$ADMIN_COOKIE" | head -c 200
echo ""
kill $DEVPID 2>/dev/null
echo "done"
