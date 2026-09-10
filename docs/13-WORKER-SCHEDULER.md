# Worker Scheduler

Checked: 2026-09-10. Implementation: src/lib/scheduler.ts.

## Session request flow
1. requestSession: assertPlanAllows (tier matrix, concurrency), model must
   be APPROVED. A session row is created in ASSIGNING.
2. scoreWorkers loads candidates: status in the alive set, heartbeat fresh
   (workerHeartbeatTimeoutSec), capacity available (activeSessions <
   maxSessions). Score components:
   - warm: READY/IDLE bonus over BOOTING/LOADING_MODEL
   - residency: existing loaded model match
   - capacity headroom ratio
   - free-first: FREE workers preferred; PAID carries a penalty
   - priority: plan-derived user priority
   - cost penalty and region/network notes where known
3. Assignment: WorkerSessionAssignment (state ASSIGNED), session CONNECTING,
   START_SESSION command with both gateway URLs.
4. No candidates: queue entry with priority, session QUEUED,
   requestCapacityTopUp(tier) invoked.

## Session end
- endSession is idempotent; ends assignments, releases worker capacity,
  cancels queue entries, sets endReason (USER_ENDED, IDLE_TIMEOUT,
  WORKER_LOST, BUDGET, ADMIN_STOP, ERROR, FAILED_HEALTH).

## Scale to zero
- Only PAID workers are stopped, only when idle past cooldown, never with
  active sessions. FREE workers (local, Kaggle assisted) are left alone;
  their idle cost is zero or already spent quota.

## Verified behaviour (2026-09-10)
- E2E session: start -> assigned to a live READY worker -> CONNECTING ->
  ACTIVE -> 30/30 converted chunks -> metrics posted -> ENDED.
- CONCURRENT_LIMIT rejection on a second concurrent session for the test
  plan was observed and is correct behaviour.
