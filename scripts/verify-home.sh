#!/usr/bin/env bash
# One-shot verification: boot dev server against Supabase, probe APIs,
# drive the homepage with agent-browser, capture evidence, tear down.
set -u
cd /home/z/my-project

# 1) Environment: always take DATABASE_URL from .env (the persistent shell
#    carries a stale exported value that would shadow .env otherwise).
set -a; source ./.env; set +a
export DATABASE_URL
echo "DB host: $(echo "$DATABASE_URL" | sed -E 's#.*@([^:/]+).*#\1#')"

# 2) Start dev server detached within THIS command's lifetime
setsid nohup bun run dev >/dev/null 2>&1 &
DEVPID=$!
UP=0
for i in $(seq 1 90); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 http://127.0.0.1:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then UP=1; echo "server UP (HTTP $code) after ~$((i*2))s"; break; fi
done
if [ "$UP" != "1" ]; then echo "SERVER FAILED TO START"; tail -40 dev.log; exit 1; fi

# 3) API probes
echo "=== /api/health ==="; curl -s --max-time 8 http://127.0.0.1:3000/api/health; echo
echo "=== /api/public/config ==="; curl -s --max-time 8 http://127.0.0.1:3000/api/public/config | head -c 240; echo
echo "=== /api/public/limits (first 300B) ==="; curl -s --max-time 8 http://127.0.0.1:3000/api/public/limits | head -c 300; echo
echo "=== /api/models (first 150B) ==="; curl -s --max-time 8 http://127.0.0.1:3000/api/models | head -c 150; echo
echo "=== /api/billing/plans (first 150B) ==="; curl -s --max-time 8 http://127.0.0.1:3000/api/billing/plans | head -c 150; echo
echo "=== /api/operator/brief ANON (expect 401/403) ==="
curl -s -o /tmp/brief.json -w "HTTP %{http_code}\n" --max-time 8 http://127.0.0.1:3000/api/operator/brief; head -c 200 /tmp/brief.json; echo
echo "=== /api/operator/brief with Origin spoof (expect 403/4xx, mutation only; GET is fine) ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 8 -H "Origin: https://evil.example" http://127.0.0.1:3000/api/operator/brief

# 4) Browser E2E
echo "=== BROWSER: open homepage ==="
agent-browser set viewport 1440 900
agent-browser open http://127.0.0.1:3000/
agent-browser wait --load networkidle
sleep 2
echo "--- title:"; agent-browser get title
echo "--- interactive snapshot (first 60 lines):"
agent-browser snapshot -i | head -60
echo "--- operator brief must NOT exist for anonymous:"
agent-browser get count "text=Operator brief" || true
agent-browser get count "text=RESTRICTED" || true
echo "--- console errors:"
agent-browser errors | head -20
echo "--- screenshot (viewport):"
mkdir -p /home/z/my-project/download
agent-browser screenshot /home/z/my-project/download/voxcore-home-hero.png && echo "hero shot saved"
echo "--- full page screenshot:"
agent-browser screenshot --full /home/z/my-project/download/voxcore-home-full.png && echo "full shot saved"

echo "=== BROWSER: navigate to voices ==="
agent-browser find text "Browse voices" click || agent-browser eval "window.location.hash='#/models'"
sleep 3
agent-browser get url
agent-browser snapshot -i | head -30

echo "=== done; leaving dev server running for preview ==="
