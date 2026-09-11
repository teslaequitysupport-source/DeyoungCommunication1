# Worklog

---
Task ID: 1
Agent: main (Super Z)
Task: Read the ULTIMATE MASTER RESEARCH + BUILD DIRECTIVE (Real-Time AI Voice Platform) and perform the pre-implementation research gate.

Work Log:
- Read full directive: /home/z/my-project/upload/Pasted Content_1789035798090.txt (2877 lines, 84 sections)
- Directive Section 2 requires: initial research, then EXACTLY 3 high-value questions, then STOP until user answers.
- Ran web searches (saved in /home/z/my-project/research/): kaggle_tos.json, rvc_license.json, wokada_latency.json, svc_licenses.json, nigeria_payments.json, zerogpu.json

Stage Summary:
- Key verified findings (2026-09, date-checked):
  - RVC (RVC-Project/Retrieval-based-Voice-Conversion-WebUI): MIT licensed code; permissive license for source + pretrained base models (per annotated-RVC by gudgud96). Community ecosystem shares custom .pth voice models with UNKNOWN rights; voice rights of any third-party voice model must be verified per-model.
  - w-okada/voice-changer (VCClient): real-time VC client supporting RVC models, GPU acceleration, custom .pth import. RVC realtime reported ~90ms end-to-end with ASIO on local GPU.
  - Seed-VC: real-time support, ~300ms algorithmic delay + ~100ms device delay; reported as commercially usable license (exact license text to be verified in Phase 1 deep audit).
  - DDSP-SVC: open source singing VC, lighter weight, real-time capable.
  - Kaggle: GPU sessions capped (~9h/session, ~30h/week), interactive idle timeouts; NOT 24/7 infrastructure. ToS commercial-use restrictions for serving third-party traffic need verification in Phase 1 (flagged risk, do not assume allowed).
  - HuggingFace ZeroGPU: quota-based (PRO $9/mo = 8x quota, $1 per 10min above), not persistent workers, not free production infra.
  - Paystack: Nigeria-first, has official Subscriptions API + webhooks; Flutterwave also viable. Both are the credible launch rails for a Nigeria-based SaaS.
- Directive constraints accepted: no em dashes anywhere; no fabricated data/claims; scale-to-zero mandatory; provider abstraction; admin command centre separate from user dashboard; 60+ required docs in /docs, /agents, /prompts.
- Next: ask exactly 3 questions (platform priority, voice model policy, billing posture) and STOP.

---
Task ID: 2 (continuation session)
Agent: main (Super Z)
Task: Complete TODO #15 (end-to-end verification), TODO #16 (documentation), TODO #17 (worklog + delivery).

Work Log:
- E2E audio diagnosis: instrumented agent (chunk trace to worker-agent/agent.log) and gateway counters (audio_c2w/audio_w2c) isolated the loss to gateway-to-worker frames for PRE-PEER chunks: the client streamed before the worker joined the pair and the gateway silently dropped.
- Fixes: (1) e2e client and studio now gate streaming on peer-ready; (2) gateway rejects pre-peer chunks with ack ok:false instead of dropping; (3) studio resets seq and gates sends on peerReadyRef; (4) gateway no longer optional-chains peer emits.
- Verified E2E twice: 30/30 chunks converted and returned, RTT P50 3 ms, P95 4-6 ms, zero loss.
- Ruled out Bun runtime: identical loss reproduced under Node 24 gateway; root cause was pre-peer streaming, not the runtime.
- FAILOVER: found and fixed heartbeat clobbering control-plane status (heartbeat route now preserves DRAINING/STOPPING/QUARANTINED/UNHEALTHY/STOPPED/FAILED while refreshing liveness); failOrphanedSessions now includes TEST sessions. verify-failover.ts: orphaned TEST session ended WORKER_LOST at ~100 s, worker returned to READY.
- RATE_LIMIT: burst straddled fixed windows (0 x 429); testRateLimit now aligns to a fresh 60 s window and fires concurrent batches. Verified: 360 burst -> exactly 240 x 200 + 120 x 429.
- SCALE_TO_ZERO: verified 0 idle paid workers with live free fleet. PASS.
- Gateway persistence: added control-plane managed service (POST/GET/DELETE /api/admin/services/gateway, engine.io handshake health probe, bun-or-node spawn, audit), GatewayServiceCard in admin Test lab panel.
- Worker hygiene: cleanup-stale.ts ends stale sessions, reconciles activeSessions, marks dead workers UNHEALTHY; retired duplicate local-agent-5 renamed.
- Lint: clean after all changes.
- Documentation: /docs 68 files (00-45 numbered, mobile set 11, scaling set 5, admin set 6, README index) with real content and dated claims; /agents 11 files (directive set); /prompts 10 files.

Stage Summary:
- All verification green: E2E audio (30/30), FAILOVER (~100 s recovery), RATE_LIMIT (240+120 x 429), SCALE_TO_ZERO (0 paid), WORKER_HEALTH, TRANSPORT, lint.
- Root causes fixed, not hidden: pre-peer silent drops, heartbeat status clobbering, testlab kind field misuse, window-straddling rate test, gateway health probe via engine.io handshake.
- Documentation reflects the real system with dated evidence; honest gaps recorded (mobile not built, MFA not enforced, live billing deferred, legal review required).
- Credentials: admin@voxcore.local / VoxCore#2026Admin, test@example.com / TestPass123x (dev seed).

---
Task ID: 3 (continuation session, 2026-09-11)
Agent: main (Super Z)
Task: Re-verify E2E audio after environment drift, finish testlab suite, update docs for protocol changes.

Work Log:
- Environment drift found after the session gap: worker fleet UNHEALTHY, cookie jars cleared, python deps missing from the interpreter the dev server actually spawns (/usr/bin/python3, PEP 668 locked) while the operator shell used /home/z/.venv/bin/python3.
- Provisioned local-agent-8 after installing requests/websocket-client/numpy/psutil/python-socketio[client] into the system python; E2E audio then PASSED: 30/30 chunks converted and returned, RTT p50 3 ms, p95 21 ms.
- Robustness fixes landed: (1) provision.ts spawns VOXCORE_AGENT_PYTHON (configurable interpreter) instead of bare python3; (2) gateway rejects missing/empty auth token gracefully instead of throwing on token.split; (3) e2e-audio.ts fails fast and ends the session when no worker/token is issued, freeing the plan concurrency slot.
- WORKER_HEALTH initially failed: PING stuck DELIVERED forever (lost ack), later commands completed. Root-caused to at-most-once command delivery with no redelivery or expiry for stuck DELIVERED rows.
- Fixed command queue to at-least-once: redeliver DELIVERED-unacked after 30 s, expire anything unresolved after 10 min; agent retries the result POST 3x with backoff; START_SESSION made idempotent (repeat ignored while session is live); WORKER_HEALTH wait raised 15 s to 45 s to honestly cover one redelivery cycle. WORKER_HEALTH then PASSED (rtt 7 s incl poll interval).
- RATE_LIMIT PASSED (300 burst aligned to one 60 s window: exactly 240 x 200 + 60 x 429, zero other statuses). SCALE_TO_ZERO PASSED (0 idle paid workers, 0 active paid). FAILOVER PASSED for real via scripts/verify-failover.ts: orphaned TEST session ended WORKER_LOST at ~120 s, worker DRAINING -> STOPPING -> reactivated READY.
- TRANSPORT PASSED (gateway engine.io handshake open, http 55 ms). CONVERSION PASSED (inferMs 0.22).
- Docs updated with dated changes: 12-WORKER-PROTOCOL.md (delivery semantics section), 38-DEPLOYMENT.md (VOXCORE_AGENT_PYTHON, agent dependency list, PEP 668 note). Lint clean after all changes.

Stage Summary:
- Full testlab suite green on 2026-09-11: WORKER_HEALTH, CONVERSION, TRANSPORT, RATE_LIMIT, SCALE_TO_ZERO, FAILOVER; E2E audio 30/30 with real DSP conversion through gateway + agent.
- Command queue is now at-least-once with bounded lifetime; workers are idempotent for repeatable commands; lost acks self-heal in seconds.
- Remaining honest gaps unchanged: mobile not built, MFA not enforced, billing architecture only (PSP deferred per user decision), Kaggle is ASSISTED capacity, legal review required before any commercial launch.
- Credentials: admin@voxcore.local / VoxCore#2026Admin, test@example.com / TestPass123x (dev seed only).

---
Task ID: 4 (Railway readiness, 2026-09-11)
Agent: main (Super Z)
Task: Make the platform deployable to Railway (single public port) without breaking local dev.

Work Log:
- Architecture change: unified server entry (server.ts) runs Next.js AND the audio gateway in ONE process on $PORT; gateway refactored into mini-services/audio-gateway/attach.ts (attachGateway(httpServer, opts)); index.ts is now a thin standalone wrapper for dev/Services card. One socket.io contract in both modes: path /gateway (the legacy "/" hijack and the ?XTransformPort edge trick are retired).
- Scheduler: gatewayMode()/gatewayEndpoints() helpers; START_SESSION payload gains gatewayPath; session API response gains gatewayUrl ("" = same origin) + gatewayPath; VOXCORE_GATEWAY_PUBLIC_URL overrides the remote gateway base for edge setups. Studio and e2e no longer hardcode URLs.
- Agent: passes payload gatewayPath to python-socketio (socketio_path); all deps (requests, websocket-client, numpy, psutil, python-socketio[client]) installed into BOTH interpreters; interpreter pinnable via VOXCORE_AGENT_PYTHON (.env sets /usr/bin/python3).
- E2E hardened: dial endpoints come from the session response; timeout path ends the session (no more wedged concurrency slot).
- Railway files: railway.toml (NIXPACKS, startCommand = prisma db push + seed-if-empty + NODE_ENV=production bun server.ts, healthcheck /api/models), requirements.txt at root (agent deps -> Nixpacks python provider), .env.example, scripts/seed-if-empty.ts (seeds only an empty DB), package.json scripts (postinstall prisma generate, start = unified server, db:deploy without --accept-data-loss), next.config standalone output removed.
- Verified: production build compiles (all routes dynamic, no DB at build); NODE_ENV=production bun server.ts on :3100 passed full E2E audio (30/30 chunks, p50 3 ms p95 6 ms) with a real spawned worker dialing ws://127.0.0.1:3100/gateway; legacy mode (next dev 3000 + standalone gateway 3003 at /gateway) also passed (30/30, p50 4 ms); TRANSPORT probe updated to /gateway and passed (32 ms); WORKER_HEALTH passed (15 s rtt incl. one redelivery cycle); lint clean.
- Docs: 38-DEPLOYMENT.md gained a full Railway section (variables, SQLite volume + single-instance honesty, capacity provisioning, mode summary); 12-WORKER-PROTOCOL.md documents the /gateway contract and endpoint handoff.

Stage Summary:
- Push-to-Railway checklist: GitHub push -> Railway deploy from repo -> set DATABASE_URL (SQLite volume at /data or Postgres with provider switch), GATEWAY_SECRET, NEXTAUTH_SECRET, APP_ORIGIN, ADMIN_EMAIL, ADMIN_PASSWORD -> deploy -> provision capacity (LOCAL or KAGGLE_ASSISTED) -> run the admin Test lab suite.
- Local dev unchanged: bun run dev (3000) + Services-card gateway (3003), now also speaking /gateway.
