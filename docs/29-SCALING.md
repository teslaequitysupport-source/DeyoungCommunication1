# Scaling Path

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
