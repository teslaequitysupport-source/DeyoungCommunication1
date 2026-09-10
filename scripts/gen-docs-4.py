#!/usr/bin/env python3
# VOXCORE docs batch 4: deployment, development, troubleshooting, roadmap,
# decisions, risks, open questions, definition of done.
import os

D = "/home/z/my-project/docs"
docs = {}

docs["38-DEPLOYMENT.md"] = """# Deployment

Checked: 2026-09-10.

## Environments
- DEVELOPMENT: this machine. bun run dev (Next.js), gateway via
  mini-services (bun index.ts), agent via the admin provision action.
  Never treat it as production.
- STAGING: same layout on a small VM; Postgres; real email provider.
- PRODUCTION: Node runtime, managed Postgres, WSS termination at the edge,
  gateway behind the same domain (path-routed) or its own host; secrets in
  a vault; ADMIN bootstrap via env.

## Environment variables (never committed)
- DATABASE_URL, NEXTAUTH_SECRET (also gateway token secret fallback),
  GATEWAY_SECRET, BACKEND_URL (agent), EMAIL_MODE (none|smtp), PORT,
  VOXCORE_GATEWAY_PORT (3003), worker heartbeat timeout override.
- Worker agents receive BACKEND_URL and a one-time token at launch; they
  never hold other secrets.

## Start order
1. Database reachable; prisma db push; seed (scripts/seed.ts) on fresh DBs.
2. Control plane up (listens 3000).
3. Audio gateway up (listens 3003) - start via the admin test lab Services
   card or POST /api/admin/services/gateway (control-plane managed).
4. Provision at least one worker; wait for READY.
5. Smoke: admin test lab TRANSPORT + WORKER_HEALTH + CONVERSION.

## Rollback
- Keep the previous build directory; swap the symlink; DB migrations are
  additive in this milestone (db push), so rollback is a symlink swap.
"""

docs["39-DEVELOPMENT.md"] = """# Development Guide

Checked: 2026-09-10.

## Run everything locally
1. bun install; prisma db push; bun scripts/seed.ts
2. bun run dev (Next.js on :3000; the platform may supervise this)
3. Gateway: cd mini-services/audio-gateway && bun index.ts (:3003)
   or start it from the admin panel (control-plane managed spawn).
4. Worker: admin panel -> GPU workers -> Provision (LOCAL). A real python
   process registers within seconds.
5. Studio: sign in as the seeded test user, pick a DSP model, go live.

## Seeded accounts
- admin@voxcore.local / VoxCore#2026Admin (change in any real deployment)
- test@example.com / TestPass123x

## Scripts
- scripts/e2e-audio.ts: E2E audio proof (needs user cookie at /tmp/user.jar
  or USER_JAR env, gateway + agent live).
- scripts/verify-failover.ts: drain-and-recover proof.
- scripts/cleanup-stale.ts: pre-test hygiene.
- scripts/verify-suite.sh: orchestrates the full suite in one session.
- scripts/seed.ts: plans (prices NULL), system models, budget policy, admin.

## Conventions
- No em dashes anywhere. Real data or none; empty states are honest.
- Every API mutation: Zod schema + rate rule + audit where admin.
- Python agent: stdlib + numpy + psutil + requests + python-socketio only;
  keep it dependency-light for notebook environments.

## Debugging tips (learned the hard way, 2026-09-10)
- If sessions hang CONNECTING: is the agent's worker row stale? Run
  cleanup-stale.ts; check heartbeat freshness; is the gateway up?
- Chunk loss that starts immediately: the client streamed before
  peer-ready; the gateway now rejects pre-peer chunks with ack false.
- Prisma stale-process errors after schema edits: db.ts schema-stamp forces
  a fresh client; restart dev servers if symptoms persist.
"""

docs["40-TROUBLESHOOTING.md"] = """# Troubleshooting

Checked: 2026-09-10. Real incidents and their fixes from this build.

## Sessions stuck CONNECTING
- Cause: the assigned worker row is stale (agent died) or the agent cannot
  reach the gateway URLs.
- Fix: cleanup-stale.ts; verify the agent process; check gatewayLocal
  reachability (ws://127.0.0.1:3003 locally); the agent tries
  gatewayRemote next.

## Audio flows partially (N of 30 chunks)
- Cause (fixed 2026-09-10): the client streamed before the worker joined
  the pair and the gateway silently dropped pre-peer chunks.
- Fix: clients wait for peer-ready; the gateway now acks false instead of
  dropping. Verify with worker-agent/agent.log recv/emit counters and
  gateway audio_c2w/audio_w2c counters.

## Worker flips from DRAINING back to IDLE
- Cause (fixed 2026-09-10): agent heartbeats overwrote control-plane
  status. Fix: heartbeat route preserves CONTROL_OWNED statuses; liveness
  still refreshes.

## FAILOVER test never recovers
- Cause: a live worker's fresh heartbeat makes the session look alive, or
  the session is younger than the 90 s staleness window.
- Fix: the maintenance loop requires the assigned worker to be alive AND
  the session older than 90 s; drain state now survives heartbeats.

## Rate limit test shows zero 429s
- Cause: a slow burst straddled two 60 s fixed windows.
- Fix (2026-09-10): the test aligns to a fresh window and fires concurrent
  batches; expect 240 allowed then 429s.

## Gateway health check fails while the port listens
- Cause: socket.io mounts at path "/", hijacking plain /health GETs.
- Fix: probe the engine.io handshake (?EIO=4&transport=polling) - what the
  admin service probe and TRANSPORT test do.

## Prisma validation errors after schema edits
- Cause: a long-lived dev server holds a stale client.
- Fix: db.ts schema-stamp detects mtime changes; restart dev if needed.

## Gateway logs unreadable
- Cause: bun --hot wrote binary garbage to the log once.
- Fix: read with strings(1); prefer starting the gateway without --hot for
  long runs, or via the control-plane spawn (plain bun).
"""

docs["41-ROADMAP.md"] = """# Roadmap

Checked: 2026-09-10. Sequential (user decision): web core first, then
desktop, then mobile, then live SaaS billing.

## Shipped (this milestone)
- Web studio with real-time conversion, recording, latency stats.
- Control plane: auth, models + moderation, sessions, metering, credits,
  support, notifications, settings, budgets, admin command centre, test lab.
- Fleet: local autonomous provider, Kaggle assisted provider, scheduler,
  scale-to-zero, self-healing, audit chain.
- Docs, agents, prompts sets.

## Next
1. Desktop shell (Tauri) + virtual microphone flow (Windows first) with the
   compatibility matrix filled from real tests.
2. RVC runtime integration behind the honest tier gate on a GPU worker.
3. Automated browser tests for the studio; load tests for the gateway.
4. Email provider integration (EMAIL_MODE=smtp) to retire the dev token
   affordance.

## Then
5. Android app (Mode A in-app conversion first; cloud path).
6. iOS app (Mode A; AVAudioEngine + mute-adjacent constraints documented).
7. Flutterwave live rails (sandbox then live) once pricing and legal are
   final; Paystack adapter behind the same interface.
8. WebRTC transport option where it beats WebSocket in measurement.
"""

docs["42-DECISIONS.md"] = """# Decision Log

Checked: 2026-09-10.

- D1 Sequential milestone order (user): web core -> desktop -> mobile ->
  live billing. Rationale: the web core exercises every subsystem; desktop
  and mobile reuse it; billing last avoids charging before value.
- D2 Deep engine audit before RVC integration (user). Rationale: license
  and latency claims must be verified, not assumed. DSP tier ships to keep
  the platform real in the meantime.
- D3 Flutterwave as first PSP (user). Rationale: Nigeria-first reach plus
  recurring API; Stripe is unavailable to Nigeria-based businesses.
- D4 socket.io for audio transport. Rationale: identical client code from
  browsers and dial-out notebooks; measured RTT adequate; WebRTC later if
  measurements justify it.
- D5 Outbound-only worker protocol. Rationale: sandboxes and notebooks
  cannot accept inbound connections; outbound-only is universally viable.
- D6 DSP as the always-available engine. Rationale: real signal processing
  with zero license risk beats a fake neural tier; RVC is gated on a real
  runtime, honestly.
- D7 Gateway holds no DB. Rationale: stateless edge, signed tokens, easy
  horizontal scale; the control plane owns all truth.
- D8 Test sessions are first class. Rationale: the failover story must be
  provable without touching customer state.
- D9 Pre-peer chunks are rejected, not dropped (2026-09-10 fix). Rationale:
  silent loss masqueraded as a transport bug; explicit acks surface truth.
- D10 Heartbeat does not override control-plane status (2026-09-10 fix).
  Rationale: an admin drain must survive agent heartbeats.
"""

docs["43-RISKS.md"] = """# Risk Register

Checked: 2026-09-10.

| Risk | Sev | Mitigation | Status |
|---|---|---|---|
| Third-party voice models used without rights | HIGH | consent records, moderation, takedown, policy text | mitigations live; review staffing is operator work |
| Kaggle ToS limits serving third parties | HIGH | Kaggle labelled dev/burst only; ToS review required | open until reviewed |
| GPL contamination (Seed-VC) | HIGH | excluded from default pipeline | contained |
| Single-machine SQLite limits | MED | Postgres migration documented | accepted for now |
| Gateway single instance | MED | stateless design; session-named gateway URLs | documented |
| No email provider in dev | MED | dev token affordance documented and gated | accepted in dev |
| Browser latency on bad networks | MED | live P50/P95 display; honest messaging | measured per session |
| Admin MFA not enforced | MED | timeout + confirmations now; TOTP designed | open |
| No automated unit suite | MED | E2E + test lab carry coverage | open |
| Operator cost runaway (paid GPU) | LOW-MED | budget guard with EMERGENCY_STOP; scale-to-zero | mitigated |
"""

docs["44-OPEN-QUESTIONS.md"] = """# Open Questions

Checked: 2026-09-10.

1. Pricing: what are the launch prices for PRO/PREMIUM/BUSINESS once GPU
   unit costs are quoted? (Blocked on real provider quotes and margin goals;
   priceCents stays NULL until then.)
2. RVC runtime distribution: install on our own GPU VM vs require operators
   to prepare images? (Blocked on provider choice.)
3. Kaggle usage: development only, or burst user traffic after ToS review?
   (Blocked on the review in 26-COMPLIANCE.md.)
4. Brand and domain: the product is VOXCORE in code and docs; final naming,
   domain and company registration details are operator decisions.
5. Desktop distribution: signed installer pipeline (code signing
   certificate budget) - required for a smooth Windows install story.
6. Data residency for non-Nigerian users: EU/US edge later, or Nigeria-only
   at launch?
7. Support staffing: who answers tickets and reviews models, with what SLA?
"""

docs["45-DEFINITION-OF-DONE.md"] = """# Definition of Done

Checked: 2026-09-10. A feature is DONE only when every box is checked.

Per feature:
- [x] IMPLEMENTED: real logic, no placeholder paths in production surfaces.
- [x] TESTED: covered by the E2E suite, a test lab kind, or a documented
      manual procedure with results recorded.
- [x] SECURED: Zod validation, rate rule, auth check, audit where admin.
- [x] ACCESSIBLE: labels, keyboard paths, contrast-safe status text.
- [x] BENCHMARKED where the claim involves performance; numbers recorded in
      32-BENCHMARKS.md with dates.
- [x] DOCUMENTED in /docs with the date and honest limits.
- [x] LICENSE-REVIEWED where third-party code or models are involved.
- [x] PRIVACY-REVIEWED for new data collection (answer the seven questions).
- [x] FAILURE-TESTED: the failure path is exercised (drain, stale, reject).
- [x] RECOVERY-TESTED where the feature claims self-healing.

Platform-level gates before any public launch (61):
- [ ] External security audit (not yet done).
- [ ] Accessibility audit with assistive tech users (not yet done).
- [ ] Legal/compliance review and NDPC posture (not yet done).
- [ ] Load test at target concurrency (not yet done).
- [ ] Real-email flows replacing dev affordances (not yet done).

Everything shipped in this milestone passes the per-feature gate; the
platform-level gates above are explicitly OPEN and are the launch blockers.
"""

for name, content in docs.items():
    with open(os.path.join(D, name), "w") as f:
        f.write(content)
print(f"wrote {len(docs)} docs to {D}")
