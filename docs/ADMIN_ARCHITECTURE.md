# Admin Architecture

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
