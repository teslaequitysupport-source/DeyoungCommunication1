# Failover

Checked: 2026-09-10. Verified by the test lab FAILOVER test.

## Triggers
- Worker process exit (agent exit marks STOPPED/FAILED via provider hook).
- Missed heartbeats: 120 s -> UNHEALTHY (detectStaleWorkers) + alert.
- Admin drain: DRAINING stops new assignments; existing sessions finish or
  are recovered as orphans if the worker cannot finish them.

## Recovery path
1. DETECT: stale heartbeat or process exit.
2. MARK: UNHEALTHY with lastError; WorkerEvent + Alert rows.
3. STOP ACCEPTING: UNHEALTHY/DRAINING workers are excluded from scoring.
4. RECOVER SESSIONS: failOrphanedSessions ends CONNECTING/ACTIVE sessions
   older than 90 s whose assigned worker is not alive. WORKER_LOST.
   DRAINING and UNHEALTHY never count as alive (fixed 2026-09-10).
   TEST sessions are included so the failover test can prove the path.
5. RE-QUEUE DEMAND: queue entries live on; capacity top-up may fire.
6. RETURN TO SERVICE: an operator (or a provider restart for AUTONOMOUS
   providers) brings the worker back; heartbeats resume; status clears via
   the recovery path (READY) - the agent's own heartbeat cannot clear a
   control-plane verdict; a real recovery action does.

## Verified observation (2026-09-10)
Drain with a TEST session attached: session ended with WORKER_LOST at
t+100 s (90 s staleness + up to 30 s tick), worker returned to READY, no
customer state touched (TEST scope only).
