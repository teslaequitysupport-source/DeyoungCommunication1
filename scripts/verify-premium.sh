#!/usr/bin/env bash
# Premium visual wave verification: ultrarealistic imagery, device-frame
# previews, store badges, banner treatment. One shell, one dev server,
# because background processes do not survive between calls in this sandbox.
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
[ "$up" = "1" ] && ok "dev server responded 200" || { bad "dev server never responded"; exit 1; }

agent-browser set viewport 1440 900 >/dev/null 2>&1
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 3
title=$(agent-browser get title 2>/dev/null)
[ -n "$title" ] && ok "landing rendered ($title)" || bad "landing title empty"

echo "== transformation imagery =="
agent-browser eval "document.querySelectorAll('img[src=\"/img/man-mic.png\"]')[0]?.closest('section')?.scrollIntoView({block:'center'})" >/dev/null 2>&1
sleep 2
imgs=$(agent-browser eval "JSON.stringify({man: document.querySelector('img[src=\"/img/man-mic.png\"]')?.naturalWidth ?? 0, woman: document.querySelector('img[src=\"/img/woman-mic.png\"]')?.naturalWidth ?? 0})" 2>/dev/null)
mans=$(echo "$imgs" | rg -o '864' | wc -l)
[ "$mans" -ge 2 ] && ok "portraits load at 864px natural width" || bad "portraits broken: $imgs"

echo "== apps section: device previews + store badges =="
agent-browser scrollintoview "#apps" >/dev/null 2>&1
sleep 2
atext=$(agent-browser get text "#apps" 2>/dev/null)
echo "$atext" | rg -qi "coming soon on" && ok "store badges: coming soon label" || bad "store badge label missing"
echo "$atext" | rg -q "App Store" && ok "store badges: App Store present" || bad "App Store badge missing"
echo "$atext" | rg -q "Google Play" && ok "store badges: Google Play present" || bad "Google Play badge missing"
echo "$atext" | rg -q "Neither store has a live listing yet" && ok "badges: honest no-listing note" || bad "honest badge note missing"
echo "$atext" | rg -q "not store screenshots" && ok "previews: honest caption present" || bad "honest caption missing"
echo "$atext" | rg -qi "hold to" && ok "studio screen: hold to speak present" || bad "hold to speak missing"
echo "$atext" | rg -qi "measured latency" && ok "studio screen: measured latency panel" || bad "latency panel missing"
echo "$atext" | rg -q "pending review" && ok "voices screen: pending review row" || bad "pending review row missing"
bars=$(agent-browser eval "document.querySelectorAll('.level-bar').length" 2>/dev/null)
[ "$bars" = "11" ] && ok "level meter: 11 animated bars" || bad "level bars count: $bars"
island=$(agent-browser eval "document.getElementById('apps').innerHTML.includes('rounded-[52px]')" 2>/dev/null)
[ "$island" = "true" ] && ok "device frame rendered" || bad "device frame missing: $island"

echo "== badge interaction =="
agent-browser eval "[...document.querySelectorAll('#apps button')].find(b => b.textContent.includes('App Store'))?.click()" >/dev/null 2>&1
sleep 1.5
focused=$(agent-browser eval "document.activeElement?.id ?? 'none'" 2>/dev/null | tr -d '"')
[ "$focused" = "wl-email" ] && ok "badge click focuses waitlist email" || bad "badge click did not focus email (got: $focused)"

echo "== copy integrity =="
dash=$(agent-browser eval "/[\u2014\u2013]/.test(document.body.innerText)" 2>/dev/null)
[ "$dash" = "false" ] && ok "landing: zero em/en dashes in rendered text" || bad "dash found in rendered text: $dash"

echo "== screenshots =="
agent-browser screenshot /home/z/my-project/agent-verify/premium-apps.png >/dev/null 2>&1 && ok "apps section screenshot" || bad "apps screenshot failed"
agent-browser eval "document.getElementById('top')?.scrollIntoView()" >/dev/null 2>&1; sleep 2
agent-browser screenshot /home/z/my-project/agent-verify/premium-hero.png >/dev/null 2>&1 && ok "hero screenshot" || bad "hero screenshot failed"
agent-browser eval "document.querySelectorAll('img[src=\"/img/man-mic.png\"]')[0]?.closest('section')?.scrollIntoView({block:'center'})" >/dev/null 2>&1; sleep 2
agent-browser screenshot /home/z/my-project/agent-verify/premium-transformation.png >/dev/null 2>&1 && ok "transformation screenshot" || bad "transformation screenshot failed"

echo "== mobile 390px =="
agent-browser set viewport 390 844 >/dev/null 2>&1
agent-browser reload >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 3
overflow=$(agent-browser eval "document.documentElement.scrollWidth - document.documentElement.clientWidth" 2>/dev/null)
[ "$overflow" = "0" ] && ok "mobile: zero horizontal overflow" || bad "mobile overflow: $overflow px"
agent-browser scrollintoview "#apps" >/dev/null 2>&1; sleep 2
agent-browser screenshot /home/z/my-project/agent-verify/premium-mobile-apps.png >/dev/null 2>&1 && ok "mobile apps screenshot" || bad "mobile screenshot failed"

echo "== guides page with new desk image =="
agent-browser open "http://localhost:3000/#/guides" >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
sleep 2
agent-browser eval "document.querySelector('img[src=\"/img/stream-desk.png\"]')?.scrollIntoView({block:'center'})" >/dev/null 2>&1
sleep 2
gimg=$(agent-browser eval "document.querySelector('img[src=\"/img/stream-desk.png\"]')?.naturalWidth ?? 0" 2>/dev/null)
[ "$gimg" = "1344" ] && ok "guides: new desk image loads" || bad "guides desk image: $gimg"

echo "== page errors =="
errs=$(agent-browser errors 2>/dev/null | tail -10)
if echo "$errs" | rg -qi "uncaught|hydration|cannot read"; then bad "page errors: $errs"; else ok "no page errors"; fi

agent-browser close >/dev/null 2>&1 || true
kill $SERVER_PID 2>/dev/null
echo "== summary: $pass passed, $fail failed =="
exit $fail
