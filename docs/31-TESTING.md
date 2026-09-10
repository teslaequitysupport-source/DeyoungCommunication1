# Testing

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
