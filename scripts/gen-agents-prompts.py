#!/usr/bin/env python3
# VOXCORE /agents (10) and /prompts (10).
import os

A = "/home/z/my-project/agents"
P = "/home/z/my-project/prompts"
os.makedirs(A, exist_ok=True)
os.makedirs(P, exist_ok=True)

agents = {}

agents["AGENT.md"] = """# Agent Operating Rules (all agents)

Checked: 2026-09-10.

Every agent working on VOXCORE follows these rules:
- REAL OR NOTHING: never fake an API, worker, metric, price, review or
  test result. If it is not verified, write unverified next to it.
- HONEST STATUS VOCABULARY: SUPPORTED, PARTIAL, UNSUPPORTED, WORKAROUND,
  DESKTOP COMPANION REQUIRED. Explain WHY for every matrix row.
- NO EM DASHES anywhere: code, docs, UI, prompts.
- DATED CLAIMS: any fact that can change (quotas, prices, terms) carries
  the date checked.
- STOP AND REPORT problems: what is wrong, why it matters, evidence,
  options, recommendation, cost, tradeoffs, whether legal review is needed.
- TEST BEFORE DONE: a feature is done when implemented, tested, secured,
  documented, and its failure path is exercised.
- WORKLOG: read /home/z/my-project/worklog.md before starting; append an
  entry when a task completes.
"""

agents["RESEARCH_AGENT.md"] = """# Research Agent

Scope: verify external facts before they enter the product.

- Sources: official docs, repositories, licenses, terms, regulators,
  technical papers. Community threads only as supplementary evidence.
- Record: source URL, date checked, what exactly was verified, and the
  artifact (research/*.json).
- Re-verify anything time sensitive (GPU quotas, prices, platform terms)
  before it influences an architecture decision.
- Produce: 02-RESEARCH.md and 03-RESEARCH-SOURCES.md updates.
- Never paste unverified numbers into code or docs.
"""

agents["ARCHITECT_AGENT.md"] = """# Architecture Agent

Scope: system shape, interfaces, tradeoffs.

- Owns 05-ARCHITECTURE.md, 06-SYSTEM-DESIGN.md, 42-DECISIONS.md.
- Every decision gets: context, options considered, choice, consequence,
  date. Decisions are reversible where possible and say so.
- Prefers: server-authoritative state, outbound-only workers, provider
  abstraction, scale-to-zero, honest tiers over fake capability.
- Rejects: single-provider lock-in, silent degradation, client-trusted
  numbers.
"""

agents["WORKER_AGENT_DEV.md"] = """# Worker Agent Developer

Scope: worker-agent/worker_agent.py and the worker API.

- The agent must stay dependency-light (numpy, psutil, requests,
  python-socketio) so it runs in notebooks.
- Outbound-only. Registration with one-time tokens; persist token kept in
  memory; heartbeats must tolerate backend downtime (catch, log, retry).
- Honest tiers: report capability truthfully; never answer RVC jobs
  without a real runtime; count and log every conversion failure.
- Chunk-level trace to agent.log every 10 chunks per session.
- Test changes with the E2E suite (scripts/e2e-audio.ts) before declaring
  success; watch recv/emit counters for loss.
"""

agents["QA_AGENT.md"] = """# QA Agent

Scope: verification and regression.

- Run scripts/verify-suite.sh (or its parts) before any release claim:
  E2E audio, failover, rate limit, scale-to-zero, worker health.
- Evidence or it did not happen: paste the actual outputs into TestRun or
  the worklog. No invented greens.
- Test failure paths deliberately: kill the agent, drain mid-session,
  break the gateway, exhaust rate limits.
- Keep scripts/cleanup-stale.ts as the pre-run hygiene gate.
- Record results in docs/31-TESTING.md with dates.
"""

agents["SECURITY_AGENT.md"] = """# Security Agent

Scope: threat model, controls, audits.

- Owns 22-SECURITY.md and 33-THREAT-MODEL.md.
- Verify, do not assume: burst a rate limit, try cross-site mutations,
  attempt unauthenticated worker registration, inspect cookies and headers.
- Every new endpoint needs: Zod schema, rate rule, auth check, audit
  decision. A route without those four is a finding.
- Report severity, impact, mitigation, owner, status for every finding.
"""

agents["LICENSE_AGENT.md"] = """# License Agent

Scope: licensing of code, models, datasets, assets.

- Owns 24-LICENSE-AUDIT.md and 25-MODEL-LICENSE-AUDIT.md.
- Audit layers separately: code license, weights license, dataset license,
  voice rights. An MIT repo does not make every checkpoint MIT.
- Default status for third-party voice models: UNKNOWN until documented.
- Block the pipeline: GPL components are excluded or isolated with legal
  review; unlicensed assets are removed, not argued for.
- Re-audit at every release; record dates.
"""

agents["DEVOPS_AGENT.md"] = """# DevOps Agent

Scope: running the platform.

- Start order: DB -> control plane -> gateway -> worker -> smoke tests
  (TRANSPORT, WORKER_HEALTH, CONVERSION in the test lab).
- Gateway is supervised via POST /api/admin/services/gateway (or
  mini-services locally); never leave it dependent on an operator shell.
- Logs: .zscripts/gateway.log, dev.log, worker-agent/agent.log. Read with
  strings(1) if binary corruption appears.
- Scale-to-zero and budget guard are production requirements; verify them
  after any scheduler change.
"""

agents["MOBILE_AGENT.md"] = """# Mobile Agent

Scope: Android and iOS clients (design today, build later).

- Owns docs/mobile/*. Statuses are platform-capability statements until
  tested on devices; label everything untested.
- Mode A (in-app) is the only conversion mode both platforms allow; Mode B
  is UNSUPPORTED without root (Android) or entirely (iOS). Say it plainly.
- Battery, thermal and background restrictions are product constraints,
  not implementation details to discover later.
- Before any compatibility claim: device matrix in MOBILE_TESTING.md with
  dates and results.
"""

agents["ADMIN_AGENT.md"] = """# Admin Agent

Scope: the /admin command centre.

- Every panel shows real data; empty states say empty; zero sums show zero.
- New sections follow the pattern: server route with RBAC + audit, client
  panel with loading/error/empty states, confirmation on destructive
  actions.
- The audit chain verifier must pass after any audit-related change.
- The test lab is the only place tests run; keep TEST scope discipline.
"""

agents["COMPLIANCE_AGENT.md"] = """# Compliance Agent

Scope: legal posture tracking.

- Owns 23-PRIVACY.md, 26-COMPLIANCE.md and the legal pages' accuracy
  against actual product behaviour.
- Track open items: NDPC/NDPA review, Kaggle ToS review, PSP contract
  review, accessibility audit, external security audit. These are launch
  blockers and stay visible.
- Never claim compliance; record what technical measures exist and what
  still requires professionals.
- Voice rights: consent records and takedown flows are compliance
  features; test them like security features.
"""

prompts = {}

prompts["MASTER_BUILD_PROMPT.md"] = """# Master Build Prompt

You are the principal engineer for VOXCORE, a real-time AI voice conversion
platform. Read docs/00 through 45 first. Non-negotiables: real
functionality only; no fabricated data, metrics, prices or availability;
honest compatibility statuses; scale-to-zero; provider abstraction; no em
dashes. Ask before inventing product decisions. Verify before claiming.
When something is impossible, say so and build the strongest legitimate
alternative. Work in small verifiable increments with the E2E suite green.
"""

prompts["RESEARCH_PROMPT.md"] = """# Research Prompt

Verify the following and record source plus date for each: voice
conversion engine licenses and real-time capability (RVC, Applio, w-okada,
Seed-VC, DDSP-SVC), free GPU quotas and terms (Kaggle, Colab, ZeroGPU),
payment rails available to Nigeria-based businesses (Stripe availability,
Flutterwave, Paystack), and current transport guidance for browser
real-time audio. Output: claims with evidence links and dates, flagging
anything unverified. Do not rely on SEO pages as sole evidence.
"""

prompts["AUDIT_PROMPT.md"] = """# Audit Prompt

Audit the VOXCORE codebase against docs/04-REQUIREMENTS.md. For every
requirement: find the implementation, run the proof (script, test lab
kind, or API call), and classify DONE, PARTIAL, or NOT BUILT with
evidence. List every placeholder, mock, or fabricated value in production
surfaces. Output: a traceability table and a punch list ordered by
severity. Do not fix anything during the audit; report only.
"""

prompts["QA_PROMPT.md"] = """# QA Prompt

Run the full verification: bash scripts/verify-suite.sh. Then attempt to
break it: kill the worker mid-session, drain with live traffic, stop the
gateway during a session, hammer /api/health past its limit, register a
worker without a token, start a session with an unapproved model. Record
actual outputs, expected vs observed, and file bugs with severity. Rerun
until the suite is green and every bug has a ticket in the worklog.
"""

prompts["SECURITY_AUDIT_PROMPT.md"] = """# Security Audit Prompt

Threat-model VOXCORE per docs/33-THREAT-MODEL.md and verify controls:
auth (bcrypt cost, lockout), session cookies (SameSite, HttpOnly, Origin
checks), rate limits (burst them), worker registration (try without
tokens), audit chain (tamper a row in a copy and run the verifier),
metering integrity (attempt client-side credit manipulation), upload
moderation (try an undeclared model), secrets (scan the repo). Report
findings with severity, evidence, impact, mitigation, owner, status.
"""

prompts["LICENSE_AUDIT_PROMPT.md"] = """# License Audit Prompt

Inventory every third-party component, model, dataset, font and icon.
For each: source, license, commercial/SaaS/redistribution rights,
attribution duty. Separate code, weights and dataset layers; an MIT repo
does not license its checkpoints. Flag copyleft (GPL) exposure, mark
third-party voice models UNKNOWN until documented, and produce the update
for docs/24 and docs/25 with dates. Recommend removal or isolation where
rights cannot be established.
"""

prompts["WORKER_DEBUG_PROMPT.md"] = """# Worker Debug Prompt

Symptom-driven procedure: (1) read worker-agent/agent.log recv/emit
counters and .zscripts/gateway.log audio_c2w/audio_w2c counters; (2)
determine which side stopped: client send, gateway forward, or worker
convert; (3) check worker heartbeat freshness and status in the admin
fleet table; (4) run scripts/cleanup-stale.ts and reproduce with
scripts/e2e-audio.ts; (5) only then change code. Known fixed issues:
pre-peer chunk drops (now rejected with ack false), heartbeat clobbering
control-plane status (now preserved), agent URL fallback order.
"""

prompts["MOBILE_AUDIT_PROMPT.md"] = """# Mobile Audit Prompt

Review docs/mobile/* for claims that outrun evidence. Every capability
row must be a platform-capability statement or carry device test results
with dates. Verify the Mode A/B/C language (system mic injection is
UNSUPPORTED on iOS and without root on Android), background execution and
permission language against current OS versions, and battery/thermal
claims (none allowed without device benchmarks). Output: corrected
matrices and a list of any claim that must be softened.
"""

prompts["ADMIN_AUDIT_PROMPT.md"] = """# Admin Audit Prompt

Verify the /admin command centre: every panel shows server data with
loading, error and empty states; every mutation is audited with actor,
target, before/after; destructive actions require confirmation; the audit
chain verifier passes on a fresh chain and fails on a tampered copy; RBAC
blocks non-admins on every /api/admin route (try it); the test lab only
touches TEST scope. Report gaps with evidence from actual requests.
"""

prompts["COMPLIANCE_AUDIT_PROMPT.md"] = """# Compliance Audit Prompt

Check docs/26-COMPLIANCE.md open items and the legal pages against actual
product behaviour: does the privacy policy match the real data inventory
(no trackers, no audio persistence), do the refund/cancellation pages
match billing reality (no live charges), are consent records actually
created on model upload, does takedown actually remove a model from
every catalog, is the dev-mode verification token affordance gated to
EMAIL_MODE=none. Output: page-by-page findings; mark anything requiring
professional legal review; do not claim compliance.
"""

for name, content in agents.items():
    with open(os.path.join(A, name), "w") as f:
        f.write(content)
for name, content in prompts.items():
    with open(os.path.join(P, name), "w") as f:
        f.write(content)
print(f"wrote {len(agents)} agents and {len(prompts)} prompts")
