#!/usr/bin/env python3
# Generates the first batch of /docs for VOXCORE (real content, dated).
# Batch 1: vision, PRD, research, requirements, architecture, system design,
# audio pipeline, voice model research, GPU research.
import os

D = "/home/z/my-project/docs"
os.makedirs(D, exist_ok=True)

docs = {}

docs["00-VISION.md"] = """# VOXCORE - Vision

Checked: 2026-09-10. No em dashes anywhere in this documentation set.

VOXCORE is a real-time AI voice conversion platform. A user selects a voice,
speaks into a microphone, and converted audio returns with minimal latency,
routed to whatever output the user chooses. The same account works from a
browser today, and the architecture leaves room for Windows, Android and iOS
clients without a rebuild.

The product has three defining commitments:

1. REAL, NOT FAKED. Every feature that claims to work does work: real worker
   processes register and heartbeat, real audio streams through the gateway,
   real converted audio returns, real usage is metered server side. Where a
   capability is not yet real (for example RVC model inference when no RVC
   runtime is installed), the system says so instead of pretending.
2. FREE FIRST. The platform starts on free capacity: a local CPU worker and
   assisted free GPU notebooks. Paid capacity exists in the architecture but
   scales to zero when unused. The scheduler prefers free workers and treats
   paid capacity as a guarded exception with budgets.
3. HONEST LIMITS. Compatibility claims carry a status: SUPPORTED, PARTIAL,
   UNSUPPORTED, WORKAROUND, or DESKTOP COMPANION REQUIRED. Anything unverified
   is marked unverified. Legal compliance is marked as requiring professional
   review where it does.

The end state: a premium real-time voice platform with an operator command
centre, a resilient multi-provider worker fleet, scale-to-zero economics, and
a clear licensing and voice-rights posture that a real business could stand on.
"""

docs["01-PRD.md"] = """# Product Requirements (PRD)

Checked: 2026-09-10.

## Personas
- STREAMER / CALLER: uses the studio live, needs low latency and stable audio.
- CREATOR: uploads or trains voices, records converted output.
- OPERATOR (admin): runs the fleet, moderates uploads, watches cost and health.

## Core user journeys
1. SIGN UP, SIGN IN: email and password, session cookie, brute force lockout.
2. START A SESSION: pick an approved model, the scheduler assigns a worker
   (or queues and asks for capacity), the studio connects to the audio
   gateway, speaks, hears converted audio live, sees latency stats.
3. UPLOAD A VOICE: upload a model file with a signed rights declaration;
   it enters moderation and only APPROVED models are usable by anyone.
4. RECORD: record converted audio in the studio to a WAV file locally.
5. OPERATE: admin provisions workers, watches heartbeats, drains or stops
   workers, moderates models, answers support tickets, sets budget policy,
   verifies the audit hash chain, runs the test lab.

## Functional requirements
- FR1 Real-time conversion sessions with per-chunk round trip stats (P50/P95).
- FR2 Worker fleet: registration with one-time tokens, heartbeats, commands,
  capacity, health, drain, stop, quarantine, provision.
- FR3 Scheduler: plan checks, tier resolution, worker scoring, queue with
  priority, capacity top-up requests, budget guard.
- FR4 Models: catalog of system models, user uploads with consent records,
  moderation queue, approve/reject/takedown, per-model license notes.
- FR5 Metering: server-side session lifecycle, usage records, credit ledger
  with idempotency keys, monthly allowance grants (idempotent).
- FR6 Billing-ready: plans exist with prices deliberately unset; a payment
  provider adapter interface exists (Flutterwave selected as the target rail);
  no live charges happen until credentials and review exist.
- FR7 Support: tickets, replies, internal notes, status, notifications.
- FR8 Admin command centre: 12 sections covering users, workers, models,
  billing, support, alerts, security, audit, settings, budgets, test lab.
- FR9 Site settings with draft, preview, approve, publish, version history.
- FR10 Observability: request metrics, worker events, alerts, audit log.

## Non-functional requirements
- NFR1 Latency: measure everything, advertise nothing unmeasured. Current
  measured gateway chunk RTT on loopback: P50 3 ms, P95 6 ms (2026-09-10).
- NFR2 Security: hashed one-time worker tokens, hashed persist tokens, bcrypt
  cost 12, progressive lockout, SameSite=strict cookies, Origin validation,
  RBAC, tamper-evident audit chain.
- NFR3 Cost: scale-to-zero for paid workers; budget policies with
  WARN / QUEUE_ONLY / EMERGENCY_STOP.
- NFR4 Privacy: data minimisation, retention sweeps, consent records, audio
  is not persisted by default in the real-time path.
- NFR5 Accessibility: keyboard navigation, labels, focus states, status
  conveyed by text not colour alone.

## Out of scope for this milestone (documented, not built)
- Windows virtual microphone driver bundling (driver signing reality).
- Native Android and iOS clients (architecture documented in /docs/mobile).
- Live payment capture (PSP interface ready; credentials and review pending).
"""

docs["02-RESEARCH.md"] = """# Research Summary

Checked: 2026-09-10. Sources recorded in 03-RESEARCH-SOURCES.md.

## Voice conversion engines
- RVC (Retrieval-based Voice Conversion): MIT licensed code; pretrained base
  models are permissively licensed per the annotated-RVC audit by gudgud96.
  Third-party .pth voice models have UNKNOWN rights by default and must be
  audited per model. Real-time use is well established in the ecosystem.
- Applio (IAHispano): MIT licensed RVC fork, active maintenance, commercial
  use permitted under MIT. Verified 2026-09-10 via repository and applio.org.
- w-okada voice-changer (VCClient): MIT licensed real-time client, proven
  real-time pipeline, tunable chunk and extra buffer, Windows/Mac.
- Seed-VC: GPL-3.0. Zero-shot conversion from a short reference clip, ~300 ms
  algorithmic delay plus ~100 ms device side delay (project README). GPL-3.0
  would force the whole product open source if used as-is in a closed SaaS.
  Decision: NOT used in the default pipeline; would require process
  isolation under GPL terms and legal review before any commercial use.
- DDSP-SVC: open source singing voice conversion, lighter weight; kept as a
  future candidate, not integrated.

## Free GPU capacity
- Kaggle: approximately 30 GPU hours per week, single session cap around
  12 hours, T4 and T4x2 available, quota resets weekly. Interactive idle
  timeouts will terminate notebooks. Verdict: legitimate but NOT 24/7
  infrastructure. Termination must be treated as normal failure and recovered
  by another worker. Kaggle ToS restrictions on serving third-party traffic
  are flagged as a compliance risk requiring review before any production use
  (see 26-COMPLIANCE.md).
- Hugging Face ZeroGPU: quota based, not persistent workers, not suitable as
  production capacity. Verdict: NOT SUITABLE for the fleet.
- Google Colab: similar constraints to Kaggle, no programmatic session
  guarantee. Verdict: FREE FOR DEVELOPMENT only.

## Paid GPU (later phase, cost-guarded)
- Modal, RunPod: per-second billing, programmatic start/stop, suitable for
  the provider interface. No credentials are configured; no prices are stated
  here because they change; the cost model doc explains the decision math.

## Payments (Nigeria context)
- Stripe is unavailable to Nigeria-based businesses (verified 2026-09-10).
- Flutterwave selected as the target rail: recurring payments API, cards and
  local methods, documented webhooks. Paystack remains a plausible second
  adapter behind the same interface.

## Transport
- WebSocket (socket.io) chosen for client-to-worker audio in this milestone:
  works everywhere including sandboxed notebooks that dial out, trivially
  deployable, and measured adequate (loopback chunk RTT P50 3 ms). WebRTC
  peer connections are the documented next step for browser-to-browser
  grade jitter handling and are NOT claimed as implemented.
"""

docs["03-RESEARCH-SOURCES.md"] = """# Research Sources

All checks dated 2026-09-10 unless stated. Search evidence stored in
research/ (ws_*.json) by the build session.

- Applio repository and applio.org Terms of Use: MIT license, commercial use
  permitted. Verified via github.com/IAHispano/Applio and applio.org.
- w-okada/voice-changer README (master): real-time VC client, Windows/Mac,
  supports RVC models. Verified via github.com/w-okada/voice-changer.
- Seed-VC repository README: real-time support, ~300 ms algorithm delay plus
  ~100 ms device delay; license GPL-3.0 (verified via aimodels.fyi summary
  of the license and the repository). Treated as GPL-3.0 without independent
  legal review.
- RVC licensing: MIT code license; community model weight rights vary; the
  annotated-RVC project (gudgud96) documents pretrained base model origins.
- Kaggle GPU quotas: ~30 h/week, ~12 h/session, weekly reset. Verified via
  Kaggle forum threads and secondary documentation (luminoai.in, 2025-2026).
  Numbers move; re-verify before relying on them.
- Hugging Face ZeroGPU: quota based PRO pricing exists; not persistent.
- Payments: flutterwave.com developer docs (recurring payments, webhooks);
  Paystack Nigeria pages. Stripe Nigeria availability: not offered.
- Transport: OpenAI Realtime API uses WebRTC for browser voice (openai.com,
  2026-05); bloggeek.me WebRTC for Voice AI overview; ably.com WebRTC vs
  WebSocket comparison.

Where a claim depends on a page that changes (quotas, prices, terms), this
documentation records the date and flags it for re-verification. Nothing in
this project claims legal compliance without professional review.
"""

docs["04-REQUIREMENTS.md"] = """# Requirements Traceability

Checked: 2026-09-10. Maps the directive's demands to what exists.

| Requirement | Status | Where |
|---|---|---|
| Real auth with lockout | DONE | src/lib/auth.ts, security events, bcrypt cost 12 |
| Rate limiting layers | DONE, VERIFIED | src/lib/rate-limit.ts; test lab RATE_LIMIT: 240 allowed, 120 x 429 |
| Worker fleet with heartbeats | DONE, VERIFIED | worker-agent/worker_agent.py, /api/worker/*, psutil telemetry |
| Worker scoring + queue | DONE | src/lib/scheduler.ts |
| Scale-to-zero | DONE, VERIFIED | scheduler.scaleToZero + maintenance sweep; test lab PASS |
| Self-healing | DONE, VERIFIED | stale worker detection (120 s), orphaned session recovery (~100 s observed), alerts |
| Provider abstraction | DONE | src/lib/provision.ts: LocalProvider (AUTONOMOUS), KaggleAssistedProvider (ASSISTED, honestly labelled) |
| Real-time audio path | DONE, VERIFIED | audio gateway + agent; E2E 30/30 chunks, RTT P50 3 ms P95 6 ms |
| Honest engine tiers | DONE | DSP tier runs real numpy DSP; RVC tier errors honestly when no runtime |
| Model moderation + consent | DONE | VoiceModel statuses, VoiceModelEvent, ConsentRecord, AbuseReport |
| Metering + credits | DONE | UsageRecord, CreditLedgerEntry with idempotency, monthly allowance sweep |
| Billing live | DEFERRED by user decision | PSP adapter interface; Flutterwave selected; no live charges |
| Admin command centre | DONE | /admin with 12 sections, separate security model |
| Audit tamper resistance | DONE | AuditLog hash chain with prevHash; verifier in admin Audit panel |
| Site settings workflow | DONE | SiteSetting + SettingVersion, draft/publish, rollback |
| Test lab | DONE, VERIFIED | 6 test kinds, TEST scope only, TestRun records |
| Legal pages | DONE | Terms, Privacy, Cookie, Refund, Cancellation, AUP, Copyright, Voice rights, Contact |
| Compatibility matrices | DONE | docs/22 and docs/mobile/*, honest statuses |
| Windows virtual mic | PARTIAL | architecture documented; no driver bundling claimed |
| Android / iOS clients | NOT BUILT | architecture documented in /docs/mobile |
| Live GPU notebook workers | WORKAROUND | Kaggle assisted notebook cell; termination is treated as normal failure |
"""

docs["05-ARCHITECTURE.md"] = """# Architecture

Checked: 2026-09-10.

## Topology

    Browser (studio, AudioWorklet capture/playback)
        |  HTTPS (Next.js API + pages, port 3000 dev)
        v
    Next.js control plane
        - Auth, sessions API, models, billing, support, admin
        - Scheduler (scoring, queue, budget guard)
        - Maintenance loop (stale detection, failover, sweeps)
        - Provisioning (LocalProvider | KaggleAssistedProvider | future)
        |  outbound-only command queue (worker polls)
        v
    Worker agent (python3 worker_agent.py)
        - registers with one-time token, receives persist token (stored hashed)
        - heartbeats: CPU/RAM/GPU telemetry via psutil (real values)
        - polls commands; runs sessions; runs TEST_JOBs for the test lab
        |  dials the gateway (outbound), authenticates with signed token
        v
    Audio gateway (mini-services/audio-gateway, socket.io, port 3003)
        - pairs exactly one client socket and one worker socket per session
        - verifies short-lived HS256 tokens locally (no database)
        - client -> worker: PCM16 chunks; worker -> client: converted PCM16
        - per-chunk RTT measurement; posts summary metrics to control plane
        |  (x-gateway-secret header, internal endpoint)

    SQLite (Prisma) for all control-plane state. Dev: file DB. Prod: swap the
    datasource to Postgres without application changes.

## Key decisions
- D1 Outbound-only workers. Workers dial the control plane and the gateway;
  no inbound ports on worker hosts (works with Kaggle and sandboxes).
- D2 Gateway holds no state of value. Signed short tokens; a gateway restart
  drops pairs but the control plane re-issues tokens on new sessions.
- D3 Real DSP for the free tier. The DSP engine is genuine signal processing
  (granular pitch shift with overlap-add, formant tilt), not a stub, with
  measured per-chunk inference around 0.2 ms on CPU.
- D4 Honest tiers. requestedTier AUTO resolves to DSP_CPU unless an RVC
  runtime exists; RVC tier requests without a runtime fail with a clear
  error rather than degrading silently.
- D5 Provider abstraction. Two providers ship (local autonomous, Kaggle
  assisted). Kaggle is labelled ASSISTED everywhere: a human pastes a
  notebook cell; the platform does not pretend to launch it.
- D6 Server-authoritative metering. Session state transitions happen in the
  control plane; the client reports latency metrics but cannot grant itself
  time or credits.
- D7 Admin is separate. /admin has its own shell, stricter rules, audit
  chain, and confirmation gates for destructive actions.

## Data flow for one spoken chunk
1. AudioWorklet captures 128 ms at 16 kHz, converts to PCM16, emits audio
   with a monotonically increasing seq (only after peer-ready).
2. Gateway assigns its own seq, records pending timestamp, forwards
   audio-in to the paired worker socket.
3. Agent converts (DSP engine or RVC when available) and emits audio back
   with the original seq.
4. Gateway matches seq to the pending map, records RTT, forwards audio-out
   to the client; playback worklet queues and plays.
5. On session end the gateway posts P50/P95 and drop percentages to the
   control plane; the studio also reports browser-measured stats.
"""

docs["06-SYSTEM-DESIGN.md"] = """# System Design Details

Checked: 2026-09-10.

## Scheduler
- assertPlanAllows: plan tier matrix and concurrent session limits.
- resolveTier: AUTO | DSP_CPU | RVC_GPU.
- scoreWorkers: heartbeat freshness gate, capacity gate, model support,
  warm bonus (READY+IDLE beats BOOTING), residency bonus, free-first bias,
  cost penalty for PAID, priority from plan. Sorted by score.
- assignWorker: creates WorkerSessionAssignment, sets CONNECTING, enqueues
  START_SESSION with gatewayLocal and gatewayRemote URLs (the agent tries
  both, in order).
- requestCapacityTopUp on queue: asks the provisioning layer to react; free
  providers can auto-provision; paid requires budget headroom.
- endSession: idempotent state transition, ends assignments, releases
  capacity, cancels queue entries.
- scaleToZero: stops PAID workers that are idle past the cooldown; never
  touches FREE workers and never a worker with active sessions.

## Maintenance loop (30 s tick, in instrumentation, Node runtime only)
- detectStaleWorkers: heartbeat older than 120 s -> UNHEALTHY + alert.
- failOrphanedSessions: CONNECTING/ACTIVE older than 90 s whose assigned
  worker is not alive (DRAINING and UNHEALTHY do not count as alive) ->
  endSession WORKER_LOST. TEST sessions included on purpose.
- scaleToZeroSweep, budgetSweep, allowanceSweep (monthly, idempotent),
  retentionSweep (heartbeats, request metrics, rate counters, tokens,
  provision requests).

## Budget guard
- evaluateBudget: daily/monthly CostRecord sums vs BudgetPolicy; modes WARN
  (allow, alert), QUEUE_ONLY (no new paid capacity, queue users),
  EMERGENCY_STOP (stop paid, alert). Free capacity is never blocked.

## Audio gateway
- Token: HS256, fields sid/uid/wid/mid/role/exp, verified locally.
- Pairing: one client + one worker per sid; duplicate role joins rejected.
- Audio: audio handler with ack; pre-peer chunks are REJECTED with
  ack ok:false, never silently dropped (fixed 2026-09-10).
- Metrics: pending map gives per-chunk RTT; P50/P95/drops reported on end.
- Pair cleanup: inactivity sweep (120 s) plus disconnect handling.

## Worker agent
- register: one-time token -> persist token; only SHA-256 of it is stored
  server side; the agent keeps it in memory only (restart re-registers via
  a new provision token for local provider; the agent is restart-safe).
- heartbeat_loop: psutil CPU/RAM, optional NVIDIA telemetry, P50/P95 of the
  recent infer window, error count, uptime.
- command_loop: polls queued commands (PING, START_SESSION, STOP_SESSION,
  SHUTDOWN, RESTART, RUN_TEST_JOB), completes each with result or error.
- session_loop: connects to gateway URL list, auths, handles audio-in with
  the engine selected honestly, traces recv/emit every 10 chunks to
  worker-agent/agent.log, and never hides conversion failures.
- run_test_job: real conversion of a provided buffer; returns infer ms and
  output bytes; powers the CONVERSION test lab test.

## Data model highlights (prisma/schema.prisma)
- Worker/WorkerHeartbeat/WorkerCommand/WorkerEvent/WorkerSessionAssignment.
- ConversionSession: status machine QUEUED -> ASSIGNING -> CONNECTING ->
  ACTIVE -> ENDING -> ENDED | FAILED | CANCELLED; isTest flag; endReason.
- CreditLedgerEntry: idempotencyKey unique; deltaCents signed.
- AuditLog: hash chain; SecurityEvent; RateLimitCounter; SiteSetting with
  SettingVersion; FeatureFlag; Alert; RequestMetric; TestRun.
"""

docs["07-AUDIO-PIPELINE.md"] = """# Audio Pipeline

Checked: 2026-09-10.

## Capture (browser)
- getUserMedia with echoCancellation and noiseSuppression configurable;
  AudioWorklet (public/worklets/capture-worklet.js) buffers 128 ms frames
  at 16 kHz and posts Float32 chunks.
- The studio converts to Int16 PCM and gates sending on peer-ready; seq
  numbers are dense from the moment streaming starts.

## Transport
- socket.io over WebSocket (polling fallback) to the gateway. Chunks are
  small (2048 samples = 4096 bytes); JSON envelope with a binary field.
- Backpressure: not a media server; slow consumers see queue growth in the
  pending map and the client sees rising RTT. Dropped pre-peer frames are
  explicitly acked false instead of vanishing.

## Conversion (worker)
- DSP engine (real, always available):
  - granular_pitch_shift: overlap-add grain resampling, grain 1024,
    hop 256, cross-faded; pitchSemitones from model params.
  - tilt_formant: frequency-domain tilt around a pivot frequency to nudge
    formant balance; factor from model params.
  - Per-chunk infer measured ~0.17-0.21 ms on this machine (2026-09-10).
- RVC engine (conditional): used only when an RVC runtime and a model file
  are actually installed on the worker. Without them, RVC tier requests are
  rejected honestly (WORKER_CANNOT_SERVE_TIER), never faked.

## Playback (browser)
- playback-worklet.js maintains a small jitter queue; underruns are counted
  and surfaced in the studio stats as bufferUnderruns.
- Recording: converted chunks are accumulated and written to a 16-bit WAV
  blob in the browser when the user arms recording.

## Latency accounting (measured, loopback, 2026-09-10)
- Gateway chunk RTT P50 3 ms, P95 6 ms (30/30 chunks, no loss).
- The number the product advertises is per-deployment measurement, never a
  global claim. The studio shows live P50/P95 for the current session.
"""

docs["08-VOICE-MODEL-RESEARCH.md"] = """# Voice Model Research

Checked: 2026-09-10.

## Ecosystem scan
- RVC family (RVC WebUI, Applio, w-okada client): the de facto standard for
  real-time .pth voice models. MIT licensed tooling; per-model rights vary.
- Seed-VC: zero-shot, GPL-3.0, excluded from the default pipeline (license).
- so-vits-svc: singing focused, non-real-time origin, maintenance cooling.
- DDSP-SVC: lighter, singing, candidate for later integration.
- Beatrice: commercial-friendly claims circulate, but the license requires
  careful reading; not integrated; marked UNVERIFIED.

## What ships in this build
- Three SYSTEM_DSP models seeded with honest params (pitch and formant
  presets). They run on the real DSP engine everywhere, no GPU needed.
- RVC support in the agent code path exists but is dormant until an operator
  installs an RVC runtime and an audited .pth on a worker. The platform will
  not claim RVC compatibility it cannot demonstrate in this environment.

## Voice rights policy (enforced in code)
- User uploads require: declaration of rights, consent record rows, and a
  voice sample consent acknowledgement for cloning flows.
- UPLOAD -> PENDING_REVIEW -> APPROVED | REJECTED | TAKEN_DOWN. Only
  APPROVED models appear in any catalog or session request.
- Abuse reports and takedown are first class; takedown is audited.
- Public figure impersonation is rejected by policy text and by review.

## Per-model audit template
- Repository, code license, weights license, dataset license and consent,
  commercial/SaaS/API/redistribution rights, attribution needs, latency,
  VRAM, streaming support, maintenance status, security notes.
"""

docs["09-GPU-RESEARCH.md"] = """# GPU and Compute Research

Checked: 2026-09-10. Quota numbers move; re-verify before relying on them.

## Classification
| Provider | Class | Verdict |
|---|---|---|
| Local CPU (this machine) | FREE FOREVER | AUTONOMOUS worker; runs the DSP tier today |
| Local NVIDIA GPU | FREE FOREVER | RVC capable when present; telemetry via psutil/nvidia-smi |
| Kaggle notebook (T4/T4x2) | FREE WITH QUOTA (~30 h/week, ~12 h/session) | ASSISTED only; dial-out works; termination is normal failure; ToS review required before serving third parties |
| Hugging Face ZeroGPU | FREEMIUM, quota based | NOT SUITABLE for fleet workers |
| Google Colab | FREE FOR DEVELOPMENT | no programmatic session guarantee; dev experiments only |
| Modal / RunPod | PAY-AS-YOU-GO | interface-ready providers; require credentials; cost-guarded |
| Any provider requiring a card | PAID | never called free |

## Provider automation classes
- AUTONOMOUS: the platform starts and stops it (LocalProvider).
- ASSISTED: the platform prepares everything (registration token, script,
  step-by-step cell) and a human pastes it (KaggleAssistedProvider).
  The UI and docs state this plainly. Kaggle does not support supported
  programmatic launching of interactive GPU sessions.
- MANUAL: reserved for future enterprise bring-your-own capacity.

## Recovery stance
A Kaggle notebook disappearing is NORMAL INFRASTRUCTURE FAILURE. The system
recovers by marking the worker UNHEALTHY on missed heartbeats (120 s),
ending orphaned sessions (90 s), re-queueing demand, and asking for capacity
top-up. Nothing in the fleet design assumes tmux or any trick keeps a
provider from terminating a notebook.
"""

for name, content in docs.items():
    with open(os.path.join(D, name), "w") as f:
        f.write(content)
print(f"wrote {len(docs)} docs to {D}")
