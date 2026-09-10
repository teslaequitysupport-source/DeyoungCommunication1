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
