# Admin Test Lab

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
