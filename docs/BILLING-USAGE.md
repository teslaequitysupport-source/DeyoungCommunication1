# Billing and Usage Metering

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
