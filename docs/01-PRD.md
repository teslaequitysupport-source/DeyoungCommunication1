# Product Requirements (PRD)

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
