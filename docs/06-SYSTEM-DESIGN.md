# System Design Details

Checked: 2026-09-10.

## Scheduler
- assertPlanAllows: plan tier matrix and concurrent session limits.
- resolveTier: AUTO | DSP_CPU | RVC_GPU.
- scoreWorkers: heartbeat freshness gate, capacity gate, model support,
  warm bonus (READY+IDLE beats BOOTING), residency bonus, free-first bias,
  cost penalty for PAID, priority from plan. Sorted by score.
- assignWorker: creates WorkerSessionAssignment, sets CONNECTING, enqueues
  START_SESSION with gatewayLocal and gatewayRemote URLs (the agent tries
  both, in order).
- requestCapacityTopUp on queue: asks the provisioning layer to react; free
  providers can auto-provision; paid requires budget headroom.
- endSession: idempotent state transition, ends assignments, releases
  capacity, cancels queue entries.
- scaleToZero: stops PAID workers that are idle past the cooldown; never
  touches FREE workers and never a worker with active sessions.

## Maintenance loop (30 s tick, in instrumentation, Node runtime only)
- detectStaleWorkers: heartbeat older than 120 s -> UNHEALTHY + alert.
- failOrphanedSessions: CONNECTING/ACTIVE older than 90 s whose assigned
  worker is not alive (DRAINING and UNHEALTHY do not count as alive) ->
  endSession WORKER_LOST. TEST sessions included on purpose.
- scaleToZeroSweep, budgetSweep, allowanceSweep (monthly, idempotent),
  retentionSweep (heartbeats, request metrics, rate counters, tokens,
  provision requests).

## Budget guard
- evaluateBudget: daily/monthly CostRecord sums vs BudgetPolicy; modes WARN
  (allow, alert), QUEUE_ONLY (no new paid capacity, queue users),
  EMERGENCY_STOP (stop paid, alert). Free capacity is never blocked.

## Audio gateway
- Token: HS256, fields sid/uid/wid/mid/role/exp, verified locally.
- Pairing: one client + one worker per sid; duplicate role joins rejected.
- Audio: audio handler with ack; pre-peer chunks are REJECTED with
  ack ok:false, never silently dropped (fixed 2026-09-10).
- Metrics: pending map gives per-chunk RTT; P50/P95/drops reported on end.
- Pair cleanup: inactivity sweep (120 s) plus disconnect handling.

## Worker agent
- register: one-time token -> persist token; only SHA-256 of it is stored
  server side; the agent keeps it in memory only (restart re-registers via
  a new provision token for local provider; the agent is restart-safe).
- heartbeat_loop: psutil CPU/RAM, optional NVIDIA telemetry, P50/P95 of the
  recent infer window, error count, uptime.
- command_loop: polls queued commands (PING, START_SESSION, STOP_SESSION,
  SHUTDOWN, RESTART, RUN_TEST_JOB), completes each with result or error.
- session_loop: connects to gateway URL list, auths, handles audio-in with
  the engine selected honestly, traces recv/emit every 10 chunks to
  worker-agent/agent.log, and never hides conversion failures.
- run_test_job: real conversion of a provided buffer; returns infer ms and
  output bytes; powers the CONVERSION test lab test.

## Data model highlights (prisma/schema.prisma)
- Worker/WorkerHeartbeat/WorkerCommand/WorkerEvent/WorkerSessionAssignment.
- ConversionSession: status machine QUEUED -> ASSIGNING -> CONNECTING ->
  ACTIVE -> ENDING -> ENDED | FAILED | CANCELLED; isTest flag; endReason.
- CreditLedgerEntry: idempotencyKey unique; deltaCents signed.
- AuditLog: hash chain; SecurityEvent; RateLimitCounter; SiteSetting with
  SettingVersion; FeatureFlag; Alert; RequestMetric; TestRun.
