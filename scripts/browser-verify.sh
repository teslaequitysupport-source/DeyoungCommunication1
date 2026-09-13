#!/usr/bin/env bash
# One-shot browser verification: boots next dev, then drives agent-browser
# across the surfaces touched by the clone/upload wave. Everything runs in a
# single shell because background processes do not survive between calls in
# this sandbox. No local Postgres exists, so authed flows land on the honest
# sign-in gate; this script verifies what is verifiable locally.
set -u
cd /home/z/my-project

pass=0; fail=0
ok()   { echo "PASS: $1"; pass=$((pass+1)); }
bad()  { echo "FAIL: $1"; fail=$((fail+1)); }

echo "== booting dev server =="
nohup bun run dev > /dev/null 2>&1 &
SERVER_PID=$!
up=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ --max-time 5 || true)
  if [ "$code" = "200" ]; then up=1; break; fi
  sleep 2
done
[ "$up" = "1" ] && ok "dev server responded 200" || { bad "dev server never responded"; tail -30 dev.log; exit 1; }

echo "== browser checks =="
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
title=$(agent-browser get title 2>/dev/null)
echo "landing title: $title"
[ -n "$title" ] && ok "landing rendered" || bad "landing title empty"

agent-browser open "http://localhost:3000/#/guides" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
gtext=$(agent-browser get text "body" 2>/dev/null)
echo "$gtext" | rg -q "Clone from files" && ok "guides: nav has clone entry" || bad "guides: nav missing clone entry"
echo "$gtext" | rg -q "Clone a voice from your own recordings" && ok "guides: clone guide section present" || bad "guides: clone guide missing"
echo "$gtext" | rg -q "upload today, training pending" && ok "guides: honest status chip present" || bad "guides: status chip missing"
echo "$gtext" | rg -q "stays queued as RECEIVED" && ok "guides: honest RECEIVED wording present" || bad "guides: RECEIVED wording missing"

agent-browser open "http://localhost:3000/#/legal/privacy" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
ptext=$(agent-browser get text "body" 2>/dev/null)
echo "$ptext" | rg -q "Voice clone samples" && ok "privacy: clone samples data category" || bad "privacy: clone category missing"
echo "$ptext" | rg -q "never published, never used for marketing" && ok "privacy: access promise present" || bad "privacy: access promise missing"
echo "$ptext" | rg -q "one click on the Voices page" && ok "privacy: deletion path documented" || bad "privacy: deletion path missing"

agent-browser open "http://localhost:3000/#/legal/voice-rights" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
vtext=$(agent-browser get text "body" 2>/dev/null)
echo "$vtext" | rg -q "Cloning from device recordings" && ok "voice-rights: clone section present" || bad "voice-rights: clone section missing"

agent-browser open "http://localhost:3000/#/models" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
mtext=$(agent-browser get text "body" 2>/dev/null)
echo "$mtext" | rg -qi "sign in" && ok "models: auth gate correct when signed out" || bad "models: unexpected content when signed out"

agent-browser open "http://localhost:3000/#/support" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
stext=$(agent-browser get text "body" 2>/dev/null)
echo "$stext" | rg -qi "contact" && ok "support page still renders" || bad "support page broken"

echo "== page errors =="
errs=$(agent-browser errors 2>/dev/null | tail -20)
if echo "$errs" | rg -qi "uncaught|hydration|cannot read"; then bad "browser page errors: $errs"; else ok "no page errors reported"; fi

agent-browser screenshot /home/z/my-project/agent-verify/clone-wave-landing.png >/dev/null 2>&1 || true
agent-browser close >/dev/null 2>&1 || true

kill $SERVER_PID 2>/dev/null
echo "== summary: $pass passed, $fail failed =="
exit $fail
