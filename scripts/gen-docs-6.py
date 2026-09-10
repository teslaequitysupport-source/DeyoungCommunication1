#!/usr/bin/env python3
# VOXCORE docs batch 6: scaling set (5) + admin set (6).
import os

D = "/home/z/my-project/docs"
docs = {}

docs["SCALE-TO-ZERO.md"] = """# Scale to Zero

Checked: 2026-09-10. NON-NEGOTIABLE per the directive; verified by test.

## Lifecycle
    NO DEMAND -> ZERO PAID WORKERS -> USER REQUEST -> PROVISION ->
    BOOT -> LOAD -> HEALTH -> READY -> SESSION -> IDLE -> COOLDOWN ->
    DRAIN -> STOP -> ZERO PAID GPU COST

## Rules implemented (src/lib/scheduler.ts scaleToZero)
- Only PAID workers are ever stopped. FREE workers (local, assisted
  notebooks) are left alone: stopping them saves nothing.
- Never stop a worker with active sessions; never stop a worker that is
  BOOTING mid-start unless the budget policy says EMERGENCY_STOP.
- Cooldown: idle past scaleToZeroCooldownSec before STOP is issued via a
  SHUTDOWN command; the provider marks the row STOPPED.
- Admin override: a worker pinned by an administrator is excluded.

## Verified (2026-09-10)
SCALE_TO_ZERO test lab run: 0 idle paid workers, 0 active paid, 5 free
workers present, emergency stop off. PASS.
"""

docs["WORKER-LIFECYCLE.md"] = """# Worker Lifecycle

Checked: 2026-09-10.

## States (directive-mandated set)
BOOTING -> LOADING_MODEL -> WARMING -> READY -> ACTIVE -> IDLE ->
DRAINING -> STOPPING -> STOPPED, plus UNHEALTHY, FAILED, RESTARTING,
QUARANTINED.

## Transitions
- Provision creates BOOTING + a one-time token.
- Agent registration -> READY (after first heartbeat).
- Assignment -> ACTIVE; last session end -> IDLE.
- Admin drain -> DRAINING (control-plane owned; agent heartbeats cannot
  clear it, fixed 2026-09-10).
- Stale heartbeat (120 s) -> UNHEALTHY + alert.
- SHUTDOWN command -> STOPPING -> STOPPED; provider exit hook -> FAILED on
  nonzero exit with lastError.
- Recovery: operator restart or provider restart; agent heartbeats resume;
  a real recovery action clears UNHEALTHY to READY. Quarantine is manual.

## Honest note
States reflect what the control plane KNOWS (heartbeats, commands, exits),
not what it hopes. A worker is healthy only while evidence says so.
"""

docs["COST-CONTROL.md"] = """# Cost Control

Checked: 2026-09-10.

## Levers
- BudgetPolicy: dailyBudgetCents, monthlyBudgetCents, mode. Modes:
  WARN (allow + alert), QUEUE_ONLY (no new paid capacity; queue users),
  EMERGENCY_STOP (stop paid workers, block paid starts, alert).
- evaluateBudget runs before paid provisioning and before paid worker
  admission in scoring; the sweep re-checks on every maintenance tick.
- CostRecord rows per provider event; the Billing panel sums actuals.
- Free-first scheduling makes free capacity structurally preferred.
- Scale-to-zero makes idle paid cost exactly zero.
- Seeded example policy: $1/day so misconfiguration cannot bleed silently.

## What cost control does NOT do
- It does not invent prices or costs; sums start at zero and grow only
  from recorded events.
- It does not silently degrade paid users' running sessions: QUEUE_ONLY
  blocks new paid capacity, not existing sessions.
"""

docs["PROVIDER-ABSTRACTION.md"] = """# Provider Abstraction

Checked: 2026-09-10. Implementation: src/lib/provision.ts.

## Interface
    provision({name, tier, requestedBy}) -> {workerId?, artifact?, instructions?}
    start(workerId) / stop(workerId) / restart(workerId) /
    terminate(workerId) / drain(workerId)
    healthCheck(workerId) -> {healthy, reason}
    getCapabilities() / getCost() -> metadata

## Shipped providers
- LocalProvider (AUTONOMOUS, FREE): spawns python3 worker_agent.py with
  BACKEND_URL and a one-time token; tracks the child process; exit hooks
  update the worker row. Real process management.
- KaggleAssistedProvider (ASSISTED, FREE): issues the registration token
  and generates a paste-ready notebook cell that downloads the agent
  script via /api/agent-script?token=... and runs it. The UI states
  plainly what is automated and what a human must do.

## Adding RunPod or Modal later
1. Implement the interface with the provider's API SDK (needs credentials
   and a budget check; both providers are PAID class).
2. Map their instance states to the worker lifecycle states.
3. Register in AVAILABLE_PROVIDERS; the admin UI picks it up.
No application code changes: scoring, queueing, top-up and the test lab
work through the interface.
"""

docs["BILLING-USAGE.md"] = """# Billing and Usage Metering

Checked: 2026-09-10.

## Server-authoritative metering
- Session state transitions happen only in the control plane. Clients
  report browser latency metrics, which are recorded as diagnostics, never
  as billing inputs.
- UsageRecord rows: session, user, tier, started/ended, duration, worker
  cost context. Failed sessions are marked and do not consume credit.
- CreditLedgerEntry: signed deltaCents, reason (MONTHLY_ALLOWANCE,
  SESSION_CONSUME, REFUND, ADMIN_GRANT), UNIQUE idempotencyKey. Replays are
  no-ops; double-credit is structurally impossible.

## Entitlements
- Plan tier matrix (which tiers a plan may use), concurrency caps, priority
  in queue scoring. Checked in requestSession, enforced server side.

## Payments (deferred)
- Flutterwave adapter interface exists; live charges deferred by user
  decision. Prices deliberately NULL. See 27-BILLING.md for the gate list.

## Admin surface
- The Billing panel shows plans, subscriptions, ledger, usage and cost
  sums; admin grants are audited with reason; refunds are ledger reversals.
"""

docs["ADMIN_ARCHITECTURE.md"] = """# Admin Architecture

Checked: 2026-09-10.

## Separation
- /admin is its own application shell (src/components/admin/*), own
  navigation, own visual language: dense, dark, operational. It is not the
  customer dashboard with a badge.
- RBAC: ADMIN role checked server side on every /api/admin route (plus
  SUPPORT where noted). Client rendering never implies permission.

## Sections (12)
Overview (fleet/session/alert pulse), GPU workers (fleet table, provision,
start/stop/restart/drain/quarantine, telemetry), Moderation (models,
reports, consent), Users (search, suspend, subscriptions, usage), Billing
(plans, ledger, costs, grants), Support (tickets, replies, notes, status),
Alerts, Security (events, lockouts, rate hits), Audit (hash chain with
verifier), Site settings (draft/publish, versions, rollback), Budgets
(policy editor with mode gates), Test lab (6 tests + gateway service card).

## Data discipline
- Every admin mutation: audited (actor, target, before/after, IP).
- Destructive actions require explicit confirmation in the UI.
- The admin's own usage does not consume customer credits; infrastructure
  cost from admin activity is still recorded honestly as cost.
"""

docs["ADMIN_SECURITY.md"] = """# Admin Security

Checked: 2026-09-10.

## In force
- Role gate on every admin route (server side), separate session timeout,
  audit chain on all mutations, security events for login anomalies,
  re-authentication prompts on destructive flows, confirmation dialogs for
  DELETE USER, DELETE DATA, STOP ALL WORKERS equivalents, billing changes
  and site publishing.
- Rate limits: adminWrite 120/min, testLab 20/min.

## Honest gaps
- MFA (TOTP) is designed but not enforced yet; until then admin accounts
  must use strong unique passwords and the operator must protect the env
  bootstrap credentials.
- IP allowlisting is deployment-level (reverse proxy), not app level.

## Bootstrap
- The seed creates one admin with a strong generated password printed once
  at seed time; change it immediately; the credential in the dev seed
  (admin@voxcore.local) is documented as dev-only.
"""

docs["ADMIN_FEATURES.md"] = """# Admin Features

Checked: 2026-09-10.

- FLEET: provision local or assisted-Kaggle workers; lifecycle commands;
  telemetry history; last error surfaced; capacity and cost class.
- SESSIONS: live states, queue depth, end reasons; TEST isolation visible.
- MODELS: upload queue with rights declarations; approve/reject/takedown;
  license notes mandatory on approve.
- USERS: search, view usage, suspend/restore, plan and credit grants
  (audited, reason required).
- BILLING: ledger browser, cost sums, monthly allowances, no invented
  revenue numbers anywhere.
- SUPPORT: assignment, priority, internal notes, status flow.
- ALERTS: WORKER_STALE, budget crossings, queue overload; acknowledged.
- SECURITY: failed logins, lockouts, rate hits, worker auth anomalies.
- AUDIT: chronological chain with one-click integrity verification.
- SETTINGS: draft -> preview -> publish -> versions -> rollback for site
  copy and theme tokens; feature flags.
- BUDGETS: daily/monthly budget, mode selector with consequences spelled
  out; emergency stop is two-step.
- TEST LAB: six real tests + gateway service supervision card.
"""

docs["ADMIN_AUDIT.md"] = """# Admin Audit Chain

Checked: 2026-09-10.

## Design
- AuditLog rows: actor, actorRole, action, targetType, targetId,
  before/after JSON, IP, createdAt, prevHash, hash.
- hash = SHA-256(prevHash + canonical(row fields)). Genesis row uses a
  fixed zero prevHash.
- The admin Audit panel lists entries and runs a verifier: recompute the
  chain in order; any mismatch marks the first broken row.

## Properties
- Tamper-evidence: editing or deleting a row breaks every later hash.
- Completeness: every admin mutation writes an entry in the same request
  (transactionally best-effort with explicit failure logging).

## Limits (honest)
- The chain proves order and integrity, not non-repudiation against a
  fully compromised DB host; for that, ship periodic anchored digests
  (documented next step).
"""

docs["ADMIN_CUSTOMIZATION.md"] = """# Admin Site Customization

Checked: 2026-09-10.

## Scope
- SiteSetting keys: brand name, tagline, hero copy, feature list, theme
  tokens (radius, spacing, accent), navigation visibility, announcement
  banner, legal page content overrides, SEO metadata.
- Workflow: DRAFT -> PREVIEW (private render) -> APPROVE -> PUBLISH.
- SettingVersion rows keep every published version; rollback reinstates a
  version atomically; change log visible in the panel.

## Guardrails
- Schema-validated values only; no arbitrary HTML injection into pages
  (rich text is restricted to a safe subset); CSP unaffected.
- Dangerous changes (e.g., disabling auth-required surfaces) are feature
  flags with confirmations, not settings typos.
"""

docs["ADMIN_TESTING.md"] = """# Admin Test Lab

Checked: 2026-09-10. Real tests, TEST-scoped, recorded in TestRun rows.

## Kinds
- WORKER_HEALTH: PING through the real command queue; RTT includes the
  agent poll interval (stated in output).
- CONVERSION: real PCM through TEST_JOB to a live worker; infer ms and
  output bytes verified; honest error if no worker can serve the tier.
- TRANSPORT: engine.io handshake probe of the gateway (path "/" rules out
  a plain /health GET), plus HTTP timing.
- RATE_LIMIT: window-aligned concurrent burst against /api/health;
  verified 240 allowed then 429s at 360 burst (2026-09-10).
- SCALE_TO_ZERO: fleet state assertion: zero idle paid workers; PASS.
- FAILOVER: drains a worker with a TEST session attached; the maintenance
  loop must end the session; rerun verifies. Verified ~100 s recovery.
- Gateway service card: probe, start, stop (control-plane managed spawn).

## Safety
- TEST scope only: isTest sessions, TEST_JOB payloads. Destructive paths
  never touch customer sessions. Every run is audited.
"""

for name, content in docs.items():
    path = os.path.join(D, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
print("wrote scaling + admin docs")
