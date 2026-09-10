#!/usr/bin/env python3
# VOXCORE docs batch 3: license audits, compliance, billing, cost model,
# scaling, observability, testing, benchmarks, threat model, API specs,
# database schema, deployment, development, troubleshooting.
import os

D = "/home/z/my-project/docs"
docs = {}

docs["24-LICENSE-AUDIT.md"] = """# License Audit (Code and Dependencies)

Checked: 2026-09-10. Runtime deps: see package.json files; audit method:
read each package's declared license at lock time and re-check before any
commercial launch.

## First-party code
- This repository: proprietary to its owner until a license is chosen.
  No third-party code was pasted in.

## Key third-party components
| Component | License | SaaS use | Notes |
|---|---|---|---|
| Next.js, React | MIT | yes | standard |
| Prisma | Apache-2.0 | yes | standard |
| socket.io, socket.io-client | MIT | yes | gateway + clients |
| Tailwind CSS, shadcn/ui primitives (Radix) | MIT | yes | radix MIT |
| zod | MIT | yes | validation |
| bcryptjs | MIT/BSD-style | yes | password hashing |
| python-socketio, requests, psutil, numpy (worker) | MIT/BSD/Apache family | yes | verify exact pins at freeze |
| Bun, Node.js runtimes | MIT-ish permissive | yes | runtime only |

## Rules
- Nocopyleft build-time or runtime dependency entered the default pipeline
  (GPL components are isolated or excluded; see 25).
- Fonts: system font stack; no external font CDN (privacy and license).
- Icons: inline/lucide (ISC/MIT family) only.
- Re-audit before each release; record the date here.
"""

docs["25-MODEL-LICENSE-AUDIT.md"] = """# Model License Audit

Checked: 2026-09-10. THIS IS THE CRITICAL AUDIT FOR A VOICE PRODUCT.

## Engine candidates
| Engine | Code | Weights/base models | Real-time | Decision |
|---|---|---|---|---|
| RVC (Retrieval-based-Voice-Conversion-WebUI) | MIT | base pretrained permissive per annotated-RVC; .pth on the hub varies | yes, proven | PRIMARY when runtime installed |
| Applio | MIT | same RVC weight caveats | yes | acceptable alternative trainer/UI |
| w-okada VCClient | MIT | n/a (client) | yes | reference implementation |
| Seed-VC | GPL-3.0 | its checkpoints inherit GPL terms | yes (~400 ms) | EXCLUDED from default pipeline; would require GPL-compliant isolation and legal review |
| DDSP-SVC | MIT-family (verify at integration) | per checkpoint | partial | future candidate |
| Beatrice | custom/nonstandard claims | per release | yes | UNVERIFIED; not integrated |

## System models shipped
- Three SYSTEM_DSP presets using the platform DSP engine. They are
  parameter sets, not trained models: no third-party weights, no dataset
  encumbrance, no voice rights issues. This is why the free tier can run
  everywhere with zero license risk.

## Third-party .pth voice models
- DEFAULT STATUS: UNKNOWN rights. A voice model may encode a real person's
  voice; using it without that person's permission risks publicity-rights,
  privacy and contract violations regardless of code licenses.
- Platform enforcement: uploads require a signed rights declaration and
  consent records; moderation review approves each model; takedown exists;
  public-figure impersonation is rejected; abuse reports are tracked.

## Before enabling RVC in production
1. Pin and record the RVC repo commit; archive its LICENSE.
2. Record the origin and license of every bundled base checkpoint.
3. Require per-model license metadata on every user upload (mandatory
   fields), plus the rights declaration; reject without it.
4. Legal review for SaaS use in target jurisdictions (required, not done).
"""

docs["26-COMPLIANCE.md"] = """# Compliance Review (Technical Posture)

Checked: 2026-09-10. NOTHING HERE IS LEGAL ADVICE OR A COMPLIANCE CLAIM.
Professional legal review is REQUIRED before production launch.

## Nigeria (primary market signals in the directive)
- NDPA (Nigeria Data Protection Act 2023): lawful basis, notice, data
  subject rights, breach notification, DPO considerations. The product
  implements the technical bones: consent records, minimisation, retention
  sweeps, export/delete endpoints, breach alerts. Registration with NDPC
  and any filings: NOT DONE; requires the operator's legal process.
- FCCPC / consumer protection: clear pricing, refund and cancellation
  terms exist as pages; pricing is deliberately unset until economics are
  real; subscription terms must be honest before charging anyone.
- Copyright: user uploads must warrant rights; takedown process exists;
  repeat infringer policy documented in the AUP.

## Cross-border
- Serving users outside Nigeria imports GDPR-like duties (EU/UK), state
  laws (US), and others. The architecture supports purpose limitation and
  deletion; the legal analysis is operator work before launch.

## Payments compliance
- Flutterwave selected. PCI scope sits with the PSP when using hosted
  checkout; webhook signature verification is implemented at the interface
  level and must be enabled with real credentials. No live charges now.

## AI/voice specific
- Voice cloning of real persons without consent is a tort and, in several
  jurisdictions, increasingly statutory territory. The platform's consent
  and moderation gates are the technical mitigations; policy text states
  the rules; enforcement is human review, which is staffed by the operator.

## Open compliance items (tracked, not hidden)
1. NDPC registration and NDPA gap review (professional).
2. Kaggle ToS review before serving third-party traffic via notebooks.
3. PSP contract review (Flutterwave) before enabling live charges.
4. Accessibility audit (WCAG AA) on real users and assistive tech.
5. Formal security audit (external) before public launch.
"""

docs["27-BILLING.md"] = """# Billing Architecture (Live Charges Deferred)

Checked: 2026-09-10. User decision: DEFER live charging. Flutterwave is the
selected PSP for the first live rail.

## What exists now (real, not fake)
- Plans: FREE, PRO, PREMIUM, BUSINESS rows with feature matrices and
  credit allowances; priceCents is deliberately NULL everywhere. No invented
  prices anywhere in the product.
- Credit ledger: CreditLedgerEntry with signed deltaCents, reason codes and
  UNIQUE idempotencyKey. Grant/consume paths are idempotent by key.
- Usage metering: server-authoritative session lifecycle; UsageRecord rows
  per session with tier, duration, and worker cost context.
- Entitlements: plan checks in the scheduler (tier matrix, concurrency)
  enforce limits on the server only.
- Monthly allowance sweep: idempotent per user per month.
- PSP adapter interface: createPaymentIntent/refund/verifyWebhook
  signatures defined; a Flutterwave implementation lands when credentials
  exist. Test-mode webhooks will be verified with signature checks before
  any state changes.

## What must exist before a single charge
1. Flutterwave account with live keys; webhook secret in the vault.
2. Price decisions from the cost model (28) and business review.
3. Legal pages finalised for subscriptions (refund/cancellation terms).
4. Entitlement sync and dunning paths tested in sandbox against the real
   webhook signatures.

## Invariants
- The client can never grant itself credit, sessions, or entitlements.
- Every ledger mutation carries an idempotency key; replays are no-ops.
- Failed sessions never consume credit; refunds are ledger reversals with
  their own keys.
"""

docs["28-COST-MODEL.md"] = """# Cost Model

Checked: 2026-09-10. No prices are fabricated; this is the decision math.

## Cost drivers per architecture
- Control plane: one small VM or serverless container (dev runs on this
  machine). Negligible at small scale.
- Database: SQLite file now; managed Postgres later (small tier).
- Audio gateway: tiny stateless service; scales with session count.
- GPU inference: THE cost. Paid per-second hosts bill per worker-second.

## Unit economics template (fill with real quotes at launch)
    cost_per_session_gpu = worker_rate_per_hour / 3600 x session_seconds
    overhead = infer_ms_per_chunk / chunk_ms (utilisation factor)
    cost_per_session = cost_per_session_gpu / overhead + egress
    price_per_session = cost_per_session / (1 - target_margin)

## Worked stance
- FREE tier: served by FREE capacity only (local DSP always; assisted
  notebooks when available). Marginal cost target: zero. The scheduler
  enforces free-first so this is structural, not aspirational.
- PAID tiers: paid capacity admitted only inside budget guard; scale-to-
  zero keeps idle paid cost at exactly zero; CostRecord rows give the
  daily/monthly actuals that the pricing decision needs.
- The budget policy ships with a $1/day example guard so that even a
  misconfiguration cannot bleed money silently.

## Measurement
- CostRecord rows are written per provision/worker-hour event with provider
  and costKind; the admin Billing panel sums them. No made-up numbers are
  displayed anywhere; empty sums show as zero, honestly.
"""

docs["29-SCALING.md"] = """# Scaling Path

Checked: 2026-09-10.

## Now (single box)
- Control plane + gateway + one or more local agents on one machine.
- SQLite, single writer. Fine for development and small pilots.

## Next (small production)
1. Managed Postgres (connection string swap).
2. Control plane behind a load balancer; sessions sticky by nothing (state
   lives in the DB); maintenance loop guarded to run on one instance via
   a leader row or lock.
3. Gateway: horizontally scalable, stateless by design; the client and the
   worker must reach the SAME gateway for a session pair, so a session-
   affinity layer (URL token names the gateway) is the documented pattern;
   gateway URLs are already issued per session by the scheduler.
4. Fleet: add providers via the interface; the scheduler scores them.

## Later
- Regional gateways for latency; queue moves to Redis or Postgres SKIP
  LOCKED if volume demands; object storage for model artifacts.

## What does not scale (honest)
- SQLite under concurrent writes; the maintenance loop on multiple
  instances without a leader; the in-memory gateway pair map beyond one
  process. Each has a documented migration above.
"""

docs["30-OBSERVABILITY.md"] = """# Observability

Checked: 2026-09-10.

## Structured logs
- Gateway: JSON lines to stdout (captured to .zscripts/gateway.log), one
  event per state change plus sampled chunk counters (audio_c2w/w2c every
  10 chunks) - never per-chunk spam.
- Agent: JSON lines to stdout; file trace at worker-agent/agent.log for
  session chunk accounting; WorkerEvent rows for operational events.
- Control plane: request metrics per route; maintenance tick logs.

## Metrics surfaces
- Admin Overview: fleet counts, session states, queue depth, alerts.
- Admin Workers: heartbeats, telemetry history, last errors.
- Admin Billing: ledger + cost sums (zeros shown as zeros).
- Studio: live P50/P95 RTT, sent/received/underruns, elapsed.

## Alerts (Alert rows, admin panel)
- WORKER_STALE, BUDGET threshold crossings, queue overload, model
  moderation events, security events. Delivery (email/webhook) is a
  documented next step; in-app alerting is real now.

## Tracing
- Per-chunk RTT is the core trace unit; seq numbers correlate a chunk
  across browser, gateway log, and agent trace for incident reconstruction.
"""

docs["31-TESTING.md"] = """# Testing

Checked: 2026-09-10. Test evidence lives in scripts/ and TestRun rows.

## End-to-end verification (executed 2026-09-10)
- E2E AUDIO: scripts/e2e-audio.ts starts a real session through the real
  scheduler against a real agent and gateway, streams 30 synthetic chunks
  after peer-ready, and verifies 30/30 converted chunks return.
  Result: PASS. RTT P50 3 ms, P95 6 ms. Two consecutive clean runs.
- FAILOVER: scripts/verify-failover.ts creates a TEST session on a live
  worker, drains via the test lab, and watches the maintenance loop.
  Result: PASS. Session ended WORKER_LOST at ~100 s; worker recovered to
  READY; customer state untouched.
- RATE_LIMIT: window-aligned concurrent burst of 360.
  Result: PASS. Exactly 240 x 200 and 120 x 429.
- SCALE_TO_ZERO: zero idle paid workers with free fleet present. PASS.
- WORKER_HEALTH: PING round trip through the real command queue. PASS
  (rtt includes the poll interval, noted honestly in the output).
- TRANSPORT: engine.io handshake probe of the gateway (socket.io mounts at
  path "/" so a plain /health GET is not a reliable probe). PASS.
- LINT: eslint clean after every change (bun run lint).

## Pre-E2E hygiene
- scripts/cleanup-stale.ts cancels stale sessions, reconciles worker
  activeSessions to live assignments, and marks demonstrably dead workers
  UNHEALTHY (same semantics as the maintenance sweep, without the wait).

## What the tests deliberately do NOT do
- No production data is touched: TEST-scoped sessions and TEST_JOBs only.
- No fabricated green checks: every claim above maps to a script run.

## Gaps (honest)
- No unit test suite yet; the E2E and test lab carry the weight.
- No load test yet: one concurrent session was exercised.
- Browser studio verified by code review and agent-browser spot checks,
  not a full automated browser suite.
"""

docs["32-BENCHMARKS.md"] = """# Benchmarks

Checked: 2026-09-10 on this machine (loopback, dev runtimes).

## Measured
| Metric | Value | Method |
|---|---|---|
| Gateway chunk RTT P50 | 3 ms | gateway pending-map matching, 30 chunks |
| Gateway chunk RTT P95 | 4-6 ms | same, two runs |
| DSP engine infer per 128 ms chunk | ~0.17-0.21 ms | agent infer_ms deque |
| Worker PING round trip | ~1.5 s | includes the agent command poll interval; noted in test output |
| Session start to ACTIVE | < 2 s with a warm worker | E2E logs |
| Agent registration to READY | ~12 s | provision-to-heartbeat observation |
| Orphan recovery | ~100 s | failover verification (90 s staleness + 30 s tick) |
| Rate limiter precision | 240 allowed / then 429 | window-aligned burst of 360 |

## Not claimed
- No GPU inference numbers: no RVC runtime or GPU exists in this
  environment, so none are stated. Benchmarks for RVC tiers land when a
  real GPU worker exists.
- No browser end-to-end latency numbers beyond the studio's own live
  display; loopback numbers above exclude real networks.
"""

docs["33-THREAT-MODEL.md"] = """# Threat Model

Checked: 2026-09-10. STRIDE-flavoured, product specific.

## Assets
Credentials and sessions; voice models and consent records; the credit
ledger; worker tokens; audit chain; user audio in transit.

## Actors
Anonymous visitor, authenticated user, paying user (later), worker operator
(ours), admin, and a malicious worker (compromised or rogue notebook).

## Stride highlights
- SPOOFING: rogue worker registration. Mitigation: one-time provision
  tokens, hashed persist tokens, provision request expiry, no self-service
  worker creation. User spoofing: bcrypt + lockout + rate limits.
- TAMPERING: ledger/credits. Mitigation: server-side only mutations,
  idempotency keys, no client-trusted amounts. Audit chain tamper evidence.
- REPUDIATION: admin actions. Mitigation: hash-chained audit with actor,
  target, before/after; chain verifier in the UI.
- INFORMATION DISCLOSURE: audio interception. Mitigation: WSS in prod,
  short-lived signed gateway tokens scoped per session per role, no audio
  persistence. Logs carry counts and seqs, never audio payloads.
- DENIAL OF SERVICE: session floods. Mitigation: sessionStart rate limit,
  plan concurrency caps, queue with priorities, budget guard stops paid
  runaway, scale-to-zero caps idle cost. Health route rate limited (verified
  240 then 429).
- ELEVATION OF PRIVILEGE: user to admin. Mitigation: RBAC checks in every
  admin route, separate admin shell, admin re-confirmation on destructive
  actions, security events on privilege-relevant activity.

## Malicious worker analysis (the interesting one)
A rogue worker cannot: read other sessions (tokens are session-scoped and
role-scoped), write to the DB (only its own worker endpoints), mint credits.
It CAN: mishandle audio it receives (privacy risk inherent to cloud
processing; stated in the privacy policy), or return garbage audio
(quality issue, detected by client-side metrics and user reports).
Mitigation posture: run your own workers only; third-party notebook
capacity requires the ToS review in 26-COMPLIANCE.md.
"""

docs["34-API-SPEC.md"] = """# API Spec (User and Public Surface)

Checked: 2026-09-10. Envelope: {ok, ...} or {error:{code, message}}.
All mutating routes: Zod validated, rate limited, Origin checked.

## Auth
- POST /api/auth/register {email, password} -> creates account; EMAIL_MODE
  none returns a dev verification token (documented, non-prod only).
- POST /api/auth/login {email, password} -> session cookie; lockout after
  10 failures for 15 min.
- POST /api/auth/logout; GET /api/auth/me.

## Models
- GET /api/models -> APPROVED models visible to the caller.
- POST /api/models (upload, multipart) -> PENDING_REVIEW; rights
  declaration required; rate limited 6/hour.
- POST /api/models/:id/report (abuse) -> queues moderation event.

## Sessions
- POST /api/sessions {modelId, requestedTier} -> ASSIGNING result with
  gatewayToken + gatewayUrls, or QUEUED position, or typed 409.
- POST /api/sessions/:id/metrics {p50Ms, p95Ms, packetsSent,
  packetsReceived, dropsPct}; POST /api/sessions/:id/end.

## Billing (deferred live charges)
- GET /api/billing/me -> plan, subscription, credit balance, usage.
- POST /api/billing/credits/purchase-intent -> PSP adapter call (409 until
  configured). No client-side success states are ever trusted.

## Support
- POST /api/support/tickets {subject, body}; GET /api/support/tickets;
  POST /api/support/tickets/:id/replies {body, internal:false}.

## Health
- GET /api/health -> {status, db:{ok, latencyMs}}; rate limited.

## Worker API (see 35) and Admin API (see ADMIN_* docs) are documented in
their own files. Idempotency: ledger and allowance endpoints require
idempotency keys; session end is idempotent by state machine.
"""

docs["35-WORKER-API.md"] = """# Worker API

Checked: 2026-09-10. Bearer persist token on every call.

- POST /api/worker/register {oneTimeToken, hardware:{...}} -> {workerId,
  persistToken}. One-time; provision request expires in 1 hour.
- POST /api/worker/heartbeat {status, activeSessions, cpuUtilPct,
  ramUsedMb, gpuUtilPct?, vramUsedMb?, inferP50Ms?, inferP95Ms?,
  errorCount, uptimeSec, loadedModels[]} -> {ok, serverTime}.
  Control-plane-owned statuses are preserved server side.
- GET /api/worker/commands -> queued commands (POLL). The agent completes:
  POST /api/worker/commands/:id/complete {ok, result?, error?}.
- POST /api/worker/events {level, kind, message, data} -> operational
  event rows surfaced in the admin Workers panel.
- POST /api/worker/session-ready {sessionId, accepted, error?} ->
  acknowledges or rejects a START_SESSION.
- Gateway (signed short token, role worker): auth, audio-in receive,
  audio emit, session-start / session-ended / peer-lost events,
  end-session with ack.

Rules: no unauthenticated calls; commands are completed exactly once;
rejected sessions report an error string for the audit trail.
"""

docs["36-DESKTOP-API.md"] = """# Desktop API Surface (Planned Client Contract)

Checked: 2026-09-10. The desktop shell reuses these; nothing new is required
server side.

- Auth: same session endpoints; device registration row planned for device
  management (schema field reserved via SecurityEvent device notes).
- Session: POST /api/sessions with clientInfo {ua, platform: desktop};
  gateway token exchange identical to web.
- Streaming: identical gateway protocol (socket.io client in the shell).
- Diagnostics: the client posts its own latency metrics on session end;
  the desktop adds audio device identifiers in clientInfo for support.
- Reconnection: exponential backoff, session resume is NOT silent; a new
  session is started (honest accounting, no ghost usage).
"""

docs["37-DATABASE-SCHEMA.md"] = """# Database Schema

Checked: 2026-09-10. Source of truth: prisma/schema.prisma. SQLite in dev.

## Grouping (about 30 models)
- Identity: User, AuthSession, VerificationToken, Plan, Subscription.
- Money: CreditLedgerEntry (idempotencyKey unique), UsageRecord, CostRecord.
- Voices: VoiceModel, VoiceModelEvent, ConsentRecord, AbuseReport.
- Fleet: Worker, WorkerHeartbeat, WorkerCommand, WorkerEvent,
  WorkerSessionAssignment, Provider, ProvisionRequest.
- Runtime: ConversionSession, QueueEntry, BudgetPolicy.
- Support/comms: SupportTicket, TicketMessage, Notification.
- Governance: AuditLog (hash chain), SecurityEvent, RateLimitCounter,
  SiteSetting, SettingVersion, FeatureFlag, Alert, RequestMetric, TestRun.

## Notable fields
- ConversionSession: isTest, endReason, requestedTier/resolvedTier,
  updatedAt @updatedAt (drives orphan detection).
- Worker: tokenHash (SHA-256 only), status machine, lastHeartbeatAt,
  activeSessions, maxSessions, costKind, providerCode.
- AuditLog: prevHash + hash per row; actor, action, target, before/after.
- db.ts schema-stamp: the client compares schema mtimes and forces a fresh
  PrismaClient after pushes, killing the stale-process bug class.

## Indexes worth knowing
- QueueEntry(status, priority, enqueuedAt); Worker(status, lastHeartbeatAt);
  RateLimitCounter unique (key, windowStart); AuditLog(createdAt).
"""

for name, content in docs.items():
    with open(os.path.join(D, name), "w") as f:
        f.write(content)
print(f"wrote {len(docs)} docs to {D}")
