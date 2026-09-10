# Billing Architecture (Live Charges Deferred)

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
