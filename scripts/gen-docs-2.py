#!/usr/bin/env python3
# VOXCORE docs batch 2: worker protocol, scheduler, failover, self-healing,
# networking, desktop, virtual mic, backend, storage, auth, security, privacy.
import os

D = "/home/z/my-project/docs"
docs = {}

docs["10-KAGGLE-WORKER.md"] = """# Kaggle Worker (ASSISTED)

Checked: 2026-09-10.

## What is true
- Kaggle gives roughly 30 GPU hours per week (T4 or T4x2), a single session
  caps around 12 hours, quota resets weekly, interactive notebooks idle-time
  out. These numbers move; the platform never hard-codes them into behavior.
- Kaggle notebooks have internet and can dial out over WebSocket. The agent
  connects outbound to the control plane and the audio gateway. No inbound
  ports are needed. This is verified with the local agent on the same code
  path; a Kaggle kernel runs the identical script.
- Kaggle does not support supported programmatic launching of interactive
  GPU sessions from our backend. Any claim of autonomous Kaggle launch would
  be false. The provider is therefore classed ASSISTED.

## What the operator does
1. Admin panel, GPU workers, Provision, provider KAGGLE_ASSISTED.
2. The platform issues a one-time registration token and renders a
   paste-ready notebook cell that downloads the agent script from
   /api/agent-script?token=... and runs it with BACKEND_URL set.
3. The operator pastes the cell into a GPU notebook and runs it.
4. The agent registers, heartbeats, and appears in the fleet as a normal
   worker (provider kaggle, costKind FREE).

## What the system does when the notebook dies
- Heartbeats stop. After 120 s the maintenance loop marks the worker
  UNHEALTHY, raises a WORKER_STALE alert, and stops new assignments there.
- Sessions on it end as WORKER_LOST after the 90 s orphan window; queued
  demand re-enters the queue and can trigger capacity top-up.
- Nothing assumes the notebook comes back. That is the correct posture.

## Compliance flags (must not be hidden)
- Kaggle Terms restrict some commercial and third-party-serving uses. Before
  routing real user traffic through Kaggle notebooks, obtain a review of the
  current Terms. Until then, Kaggle capacity is for development, testing,
  and burst capacity, and is labelled as such in the admin UI.
"""

docs["11-TMUX-WORKER.md"] = """# tmux and Worker Process Management

Checked: 2026-09-10.

tmux is useful for humans inspecting worker processes; it is not
infrastructure persistence and this project never treats it as such.

## Where tmux fits
- On a self-managed VPS, running the agent inside tmux gives operators a
  detachable terminal, scrollback for debugging, and easy restart scripts.
- The agent is a plain foreground process; wrapping it in tmux changes
  nothing about its behaviour or registration.

## Where tmux does NOT fit
- Cloud notebooks: when Kaggle terminates the kernel, tmux dies with the
  machine. No terminal multiplexer prevents provider termination.
- As a supervision primitive: the platform's supervisor is the control
  plane itself (heartbeats, stale detection, commands), not tmux.

## Recommended operator pattern (self-managed hosts)
1. tmux new -s worker-agent
2. BACKEND_URL=... WORKER_REG_TOKEN=... python3 worker_agent.py
3. Ctrl-b d to detach; tmux attach -t worker-agent to inspect.
4. Restart by re-provisioning a token from the admin panel; the old worker
   record goes UNHEALTHY on its own.
"""

docs["12-WORKER-PROTOCOL.md"] = """# Worker Protocol

Checked: 2026-09-10. Implementations: src/app/api/worker/*,
worker-agent/worker_agent.py.

## Registration
1. Operator provisions a worker; the control plane creates a Worker row
   (status BOOTING) and a ProvisionRequest holding a hashed one-time token
   (1 hour expiry).
2. The agent POSTs /api/worker/register with the one-time token.
3. The server validates the hash, marks the request ASSUMED, returns a
   persist token. Only the SHA-256 of the persist token is stored.
4. All subsequent calls use Authorization: Bearer <persist token>.

## Heartbeat
- POST /api/worker/heartbeat every HEARTBEAT_SEC (~20 s): status,
  activeSessions, CPU/RAM (psutil), GPU telemetry when available,
  inferP50/P95 over the recent window, errorCount, uptime, loadedModels.
- Control-plane-owned statuses (DRAINING, STOPPING, QUARANTINED, UNHEALTHY,
  STOPPED, FAILED) are NOT overwritten by agent heartbeats; liveness
  (lastHeartbeatAt) always refreshes. Fixed 2026-09-10: previously an agent
  heartbeat could clobber an admin drain.

## Commands (outbound-only: the agent polls)
- PING: liveness round trip, agent returns pong with its status.
- START_SESSION: payload sessionId, gatewayLocal, gatewayRemote, modelId;
  the agent dials the gateway URLs in order, authenticates with the signed
  token (worker role), and waits for session-start.
- STOP_SESSION: signals the session loop to stop.
- RUN_TEST_JOB: real conversion of a provided PCM buffer; returns infer ms
  and output size; used by the CONVERSION test lab test.
- SHUTDOWN / RESTART: lifecycle; agent exits or respawns cleanly.
- Every command completes with result or error; completion is audited.

## Session streaming (gateway, socket.io)
- Agent connects (websocket), emits auth {token} (worker role), waits for
  session-start, then handles audio-in {seq, ts, audio} and emits audio
  {seq, audio} back. Frames arrive at a 128 ms cadence.
- The agent emits from within its receive handler; conversion is fast
  (DSP ~0.2 ms per chunk); failures are counted and logged, never silent.
- Chunk-level tracing lands in worker-agent/agent.log every 10 chunks
  (recv/emit counters with seq and infer time). Added 2026-09-10.

## Rules
- No unauthenticated registration (one-time token required).
- No inbound connections from the control plane to workers, ever.
- A worker that cannot serve a tier says so (WORKER_CANNOT_SERVE_TIER).
"""

docs["13-WORKER-SCHEDULER.md"] = """# Worker Scheduler

Checked: 2026-09-10. Implementation: src/lib/scheduler.ts.

## Session request flow
1. requestSession: assertPlanAllows (tier matrix, concurrency), model must
   be APPROVED. A session row is created in ASSIGNING.
2. scoreWorkers loads candidates: status in the alive set, heartbeat fresh
   (workerHeartbeatTimeoutSec), capacity available (activeSessions <
   maxSessions). Score components:
   - warm: READY/IDLE bonus over BOOTING/LOADING_MODEL
   - residency: existing loaded model match
   - capacity headroom ratio
   - free-first: FREE workers preferred; PAID carries a penalty
   - priority: plan-derived user priority
   - cost penalty and region/network notes where known
3. Assignment: WorkerSessionAssignment (state ASSIGNED), session CONNECTING,
   START_SESSION command with both gateway URLs.
4. No candidates: queue entry with priority, session QUEUED,
   requestCapacityTopUp(tier) invoked.

## Session end
- endSession is idempotent; ends assignments, releases worker capacity,
  cancels queue entries, sets endReason (USER_ENDED, IDLE_TIMEOUT,
  WORKER_LOST, BUDGET, ADMIN_STOP, ERROR, FAILED_HEALTH).

## Scale to zero
- Only PAID workers are stopped, only when idle past cooldown, never with
  active sessions. FREE workers (local, Kaggle assisted) are left alone;
  their idle cost is zero or already spent quota.

## Verified behaviour (2026-09-10)
- E2E session: start -> assigned to a live READY worker -> CONNECTING ->
  ACTIVE -> 30/30 converted chunks -> metrics posted -> ENDED.
- CONCURRENT_LIMIT rejection on a second concurrent session for the test
  plan was observed and is correct behaviour.
"""

docs["14-FAILOVER.md"] = """# Failover

Checked: 2026-09-10. Verified by the test lab FAILOVER test.

## Triggers
- Worker process exit (agent exit marks STOPPED/FAILED via provider hook).
- Missed heartbeats: 120 s -> UNHEALTHY (detectStaleWorkers) + alert.
- Admin drain: DRAINING stops new assignments; existing sessions finish or
  are recovered as orphans if the worker cannot finish them.

## Recovery path
1. DETECT: stale heartbeat or process exit.
2. MARK: UNHEALTHY with lastError; WorkerEvent + Alert rows.
3. STOP ACCEPTING: UNHEALTHY/DRAINING workers are excluded from scoring.
4. RECOVER SESSIONS: failOrphanedSessions ends CONNECTING/ACTIVE sessions
   older than 90 s whose assigned worker is not alive. WORKER_LOST.
   DRAINING and UNHEALTHY never count as alive (fixed 2026-09-10).
   TEST sessions are included so the failover test can prove the path.
5. RE-QUEUE DEMAND: queue entries live on; capacity top-up may fire.
6. RETURN TO SERVICE: an operator (or a provider restart for AUTONOMOUS
   providers) brings the worker back; heartbeats resume; status clears via
   the recovery path (READY) - the agent's own heartbeat cannot clear a
   control-plane verdict; a real recovery action does.

## Verified observation (2026-09-10)
Drain with a TEST session attached: session ended with WORKER_LOST at
t+100 s (90 s staleness + up to 30 s tick), worker returned to READY, no
customer state touched (TEST scope only).
"""

docs["15-SELF-HEALING.md"] = """# Self-Healing

Checked: 2026-09-10.

## Failure inventory and automatic response
| Failure | Detection | Response |
|---|---|---|
| Worker crash | provider exit hook + missed heartbeats | STOPPED/FAILED or UNHEALTHY; sessions recover; alert |
| Notebook termination | missed heartbeats | UNHEALTHY; sessions WORKER_LOST; top-up request |
| Model load failure | agent reports error count, status | worker not scored as warm; operator sees lastError |
| Gateway down | client connect errors; TRANSPORT test; admin service probe | sessions cannot stream; pair tokens are re-issued on new sessions; service can be restarted from the admin test lab |
| Backend down mid-session | agent heartbeat loop keeps retrying and logs HEARTBEAT_FAILED | when the backend returns, heartbeats resume; worker marked stale meanwhile is cleared by a real recovery action |
| Stuck session | failOrphanedSessions (90 s) | WORKER_LOST end; queue re-entry |
| Budget overrun | budgetSweep | WARN/QUEUE_ONLY/EMERGENCY_STOP per policy |
| Orphaned assignment counters | cleanup + sweep reconciliation | activeSessions reconciled to live assignments |

## Design rules
- Never pretend a failed worker is healthy; UNHEALTHY is control-plane
  owned until a real recovery clears it.
- Every automatic action writes an event or alert; silence is a bug.
- Idempotency on sweeps: repeated ticks are safe; allowance grants are
  idempotent by month; session ends are idempotent by state machine.

## Known gaps (honest)
- The agent heartbeat loop tolerates backend downtime by catching errors,
  but if the loop thread itself dies (unhandled bug), only the 120 s stale
  path notices. A watchdog thread inside the agent is a future hardening.
- Gateway restart drops in-flight pairs; clients currently surface an error
  and the user restarts the session. Automatic pair re-establishment is a
  documented next step.
"""

docs["16-NETWORKING.md"] = """# Networking

Checked: 2026-09-10.

## Ports
- 3000: Next.js control plane (HTTP + API). Dev: bun run dev.
- 3003: audio gateway (socket.io over HTTP/WebSocket). Path "/".
- Workers: outbound only. No inbound ports on worker hosts.

## Transport choices
- Control plane: plain HTTP(S) request/response; cookie sessions for users,
  bearer persist tokens for workers, signed short JWTs for gateway roles.
- Audio: socket.io (WebSocket first, polling fallback). Chosen because it
  works from browsers and from dial-out notebooks with identical code,
  survives proxies that kill idle TCP (heartbeats), and reconnection is
  built in on the client side. WebRTC is documented as a future transport
  for peer-grade jitter handling; it is not implemented here and is not
  claimed.
- NAT traversal: not needed for the outbound-only worker model. TURN/STUN
  enter the design only if WebRTC peering is added later.

## Latency instrumentation
- The gateway timestamps every client chunk and matches worker responses by
  seq to produce per-chunk RTT; P50/P95 go to the control plane at session
  end. The browser measures its own P50/P95 independently and displays it.

## Failure handling
- socket.io client reconnection (studio) with attempt cap; agent reconnects
  by ending the session loop (the scheduler re-queues demand).
- Gateway pair inactivity sweep: 120 s.
- Engine.io ping/pong: 15 s interval, 30 s timeout (gateway default tuned).

## Measured reference (loopback, 2026-09-10)
- Gateway chunk RTT P50 3 ms, P95 6 ms; agent conversion ~0.2 ms per chunk;
  end-to-end browser numbers are deployment specific and are measured in
  the studio, not advertised here.
"""

docs["17-DESKTOP-APP.md"] = """# Desktop App (Windows First)

Checked: 2026-09-10. Status: architecture documented; native shell not built
in this milestone. The web studio already covers in-browser use on any OS.

## Recommended shape
- Tauri (Rust) shell wrapping the same studio UI, with a native audio
  module; or a thin native tray app plus the browser studio.
- Account, device registration, session and voice selection reuse the same
  REST/session APIs as the web studio. No second backend.

## Audio I/O plan
- Capture: WASAPI shared mode via a Rust crate (cpal) or the browser stack
  inside the webview.
- Output: two paths. (a) monitor to the default output; (b) virtual
  microphone for other apps to consume (see 18-VIRTUAL-MICROPHONE.md).

## Virtual microphone routing (Mode B)
- The desktop app writes converted PCM into a virtual audio device; Discord,
  Zoom, OBS and friends select that device as a microphone.
- Driver reality: VB-CABLE is the pragmatic choice on Windows. It is
  donationware with a free license for personal use; commercial bundling
  requires an agreement with the author. Open-source alternatives exist
  (e.g., Scream, VirtualAudioCable-like projects) with varying maturity and
  signing status. Driver signing means the platform CANNOT silently install
  a virtual device; the app must guide installation and verify presence.

## Compatibility matrix (Windows 10/11)
| Target app | Status | Why |
|---|---|---|
| OBS (mic source = CABLE) | SUPPORTED (via virtual device) | standard WASAPI capture |
| Discord (input = CABLE) | SUPPORTED (via virtual device) | standard capture path |
| Zoom (input = CABLE) | SUPPORTED (via virtual device) | standard capture path |
| Browser Meet/Teams (input = CABLE) | PARTIAL | browser device pickers vary; user selects the device |
| System-wide mic replacement | UNSUPPORTED | Windows does not allow global mic swap without drivers per app |

Statuses are honest defaults from platform capabilities; per-app testing on
real hardware is still required before shipping claims. None of these are
tested in this environment, which has no Windows host or audio hardware.
"""

docs["18-VIRTUAL-MICROPHONE.md"] = """# Virtual Microphone

Checked: 2026-09-10.

## Windows
- VB-CABLE (donationware): installs a virtual playback+capture pair. Our app
  plays converted audio into CABLE Input; other apps capture CABLE Output.
  License: free for personal use; redistribution/bundling needs author
  agreement. Signing: driver is signed by the author; installation needs
  admin rights. The platform does not bundle or silently install it.
- Open-source alternatives: Scream (virtual sound card, more oriented to
  audio streaming), VB-Audio alternatives, VirtualAudioCable (paid).
  None are bundled in this milestone; all require the same install-and-
  verify flow.

## Android
- Global mic replacement is not permitted to normal apps. In-app conversion
  (Mode A) is the primary path. Feeding other apps requires either OEM
  features or root, which is out of scope; documented as UNSUPPORTED
  without root.

## iOS
- System-wide microphone replacement is not permitted. In-app conversion
  only; audio unit extensions exist for host apps that integrate them.
  Documented honestly as UNSUPPORTED for third-party app injection.

## Verification plan (when a Windows host is available)
1. Install VB-CABLE; confirm devices appear.
2. Play a test tone into CABLE Input; capture from CABLE Output in
   Audacity; measure latency and drift.
3. Repeat with Discord, Zoom, OBS; record results in this matrix with dates.
Until that run happens, the matrix rows above stay labelled as
platform-capability defaults, not tested claims.
"""

docs["19-BACKEND.md"] = """# Backend (Control Plane)

Checked: 2026-09-10.

## Stack
- Next.js (App Router, TypeScript), dev runtime bun, prod target Node.
- Prisma + SQLite in dev; Postgres-ready datasource swap for production.
- Zod validation at every API boundary (src/lib/validate.ts).
- socket.io (server) only inside the standalone gateway service.

## Layout
- src/app/api/*: REST handlers grouped by area (auth, sessions, models,
  billing, support, admin, worker, internal).
- src/lib/*: db (schema-stamp aware singleton), auth (bcrypt cost 12,
  lockout, sessions), http (wrap: validation, rate limit, metrics, errors),
  scheduler, provision, budget, credits, audit (hash chain), rate-limit,
  maintenance, worker-commands.
- instrumentation.ts: starts the maintenance loop in the Node runtime only.

## API conventions
- jsonOk / wrap: consistent envelope {ok, ...} or {error:{code,message}}.
- Every mutating admin action is audited with actor, target, before/after.
- Rate limit rules per area (see 22-SECURITY.md table).
- Request metrics recorded per route with skipMetrics opt-outs for
  heartbeats and health.

## Error taxonomy
- 401 UNAUTHORIZED, 403 FORBIDDEN, 409 typed codes (CONCURRENT_LIMIT,
  TIER_NOT_IN_PLAN, BUDGET, MODEL_UNAVAILABLE, RATE_LIMITED), 429 with
  Retry-After, 500 with a stable code and no stack traces to clients.
"""

docs["20-STORAGE.md"] = """# Storage

Checked: 2026-09-10.

## What is stored where
- Database (SQLite in dev): all control-plane state. No audio blobs.
- Real-time audio: never persisted. Chunks live in memory for the duration
  of the hop (browser -> gateway -> worker) and are gone after playback.
- Studio recordings: created and saved locally in the user's browser
  (WAV blob download). The server never receives them.
- Model files (future RVC .pth uploads): object storage bucket with signed
  URLs, antivirus gate in the upload pipeline, checksums recorded. Not
  active in this environment; the schema and flow exist.

## Retention (enforced by maintenance sweeps)
- WorkerHeartbeat: 24 h. RequestMetric: 24 h. RateLimitCounter: past
  windows pruned. VerificationToken: past expiry (48 h cap).
  ProvisionRequest: 7 d after expiry.
- Voice model uploads: deleted with the model row; consent records are
  retained (legal basis) but decoupled from audio.
- AuditLog and SecurityEvent: retained; they are the compliance record.

## Backups
- Dev: file copy of the DB is acceptable; not automated here.
- Production: managed Postgres with PITR recommended; model object store
  versioning; restore drill documented in 47/48 docs. Nothing in the
  architecture assumes a single provider is permanent.
"""

docs["21-AUTH.md"] = """# Authentication

Checked: 2026-09-10.

## Users
- Email + password. Passwords hashed with bcrypt cost 12. No plaintext ever
  stored or logged.
- Sessions: HttpOnly, SameSite=strict cookie; Origin/Referer validation on
  mutating requests (CSRF defence in depth); session rows are revocable;
  logout destroys the session.
- Brute force: progressive lockout at 10 failed attempts for 15 minutes,
  SecurityEvent rows for failures and lockouts.
- EMAIL_MODE=none (this environment): verification emails cannot be sent,
  so the dev flow surfaces the verification token in the response. This is
  an honest development-mode affordance, gated to non-production email
  config, and is documented wherever accounts are created.
- Password reset: token flow exists; delivery requires a real mail provider
  (same EMAIL_MODE gate).

## Workers
- One-time registration token (hashed at rest) exchanged for a persist
  token; only the SHA-256 of the persist token is stored. Bearer auth on
  every worker call. Registration requires a provisioned row; arbitrary
  self-registration is impossible.

## Admin
- Same user auth plus role check (RBAC: USER | SUPPORT | ADMIN), separate
  shell and layout, re-confirmation on destructive actions, audit chain on
  every mutation, session timeout policy for admin roles.

## Tokens on the audio path
- The scheduler issues short-lived HS256 gateway tokens per role per
  session; the gateway verifies them locally with the shared secret; no
  database lookup, no long-lived credentials at the edge.
"""

docs["22-SECURITY.md"] = """# Security

Checked: 2026-09-10.

## Controls implemented
- Input validation: Zod schemas on every mutating endpoint; unknown fields
  stripped; types enforced at the boundary.
- XSS: React escaping by default; no dangerouslySetInnerHTML in product
  surfaces; CSP headers set at the edge config for dev parity.
- CSRF: SameSite=strict session cookies plus Origin/Referer checks on
  mutations; state-changing APIs reject cross-site origins.
- Injection: Prisma parameterised queries only; no string-built SQL.
- Path traversal: uploads normalised and confined; filename randomisation.
- Session security: HttpOnly + SameSite=strict; secure flag in prod; idle
  timeout for admin; session revocation on logout and password change.
- Rate limits (DB-backed fixed window, shared):
  | area | rule | limit |
  |---|---|---|
  | login | authLogin | 10 / 300 s |
  | register | authRegister | 5 / 3600 s |
  | password reset | authPasswordReset | 5 / 3600 s |
  | api read | apiRead | 240 / 60 s |
  | api write | apiWrite | 60 / 60 s |
  | session start | sessionStart | 10 / 300 s |
  | model upload | modelUpload | 6 / 3600 s |
  | worker register | workerRegister | 30 / 300 s |
  | worker heartbeat | workerHeartbeat | 30 / 60 s |
  | admin write | adminWrite | 120 / 60 s |
  | test lab | testLab | 20 / 60 s |
  Verified 2026-09-10: burst of 360 -> exactly 240 allowed, 120 x 429.
- Worker impersonation: one-time tokens, hashed persist tokens, provision
  request expiry, worker rows cannot self-create.
- Audit tamper resistance: hash chain (each row embeds the previous hash);
  the admin Audit panel verifies the chain on demand.
- Secrets: .env only; no secrets committed; gateway secret and NextAuth
  secret configurable per environment; dev defaults are labelled dev-only.

## Threat model summary (full: 33-THREAT-MODEL.md)
Key threats addressed: credential stuffing (lockout + limits), session
hijack (strict cookies, Origin checks), worker impersonation (token flow),
billing manipulation (server-authoritative metering, idempotent ledger),
admin takeover (RBAC + audit + confirmations), malicious uploads
(moderation gate + scan before approval), audio privacy (no persistence).

## Known limitations (honest)
- SQLite in dev is not a production security boundary for concurrency.
- The dev-mode verification token display (EMAIL_MODE=none) must be disabled
  in any real deployment.
- Admin MFA is designed (session timeout + confirmations) but not yet
  TOTP-enforced; documented as a gap, not a feature.
"""

docs["23-PRIVACY.md"] = """# Privacy and Data Minimisation

Checked: 2026-09-10.

## Data inventory (the whole list)
- Account: email, password hash, role, timestamps.
- Sessions/devices: session rows, IP and user agent on security events only.
- Usage: session lifecycle rows, latency metrics (numbers, not audio),
  usage records, credit ledger entries.
- Voice models: metadata, license notes, consent records, moderation state.
- Support: tickets and messages the user writes.
- Operations: worker telemetry, audit chain, security events, alerts.

## What is never collected
- Real-time audio is not recorded server side. Chunks transit memory and
  are dropped. No analytics SDK, no third-party trackers, no ads, no
  fingerprinting, no external fonts.

## Rights supported in code
- Export: account + usage export endpoint (JSON) for the requesting user.
- Deletion: account deletion cascade with documented exceptions (audit and
  security records retained for legal basis; ledger retained anonymised).
- Consent: ConsentRecord rows for voice uploads and cloning declarations;
  withdrawal triggers takedown review of the linked model.

## Retention
See 20-STORAGE.md. Sweeps run automatically in the maintenance loop.

## Nigeria NDPA posture
- Lawful basis recorded per processing purpose; data minimisation by design;
  retention schedules documented; breach alerting exists (alerts table).
  A formal NDPC registration/compliance review by a professional is
  REQUIRED before production launch; this build does not claim compliance.
"""

for name, content in docs.items():
    with open(os.path.join(D, name), "w") as f:
        f.write(content)
print(f"wrote {len(docs)} docs to {D}")
