# Self-Healing

Checked: 2026-09-10.

## Failure inventory and automatic response
| Failure | Detection | Response |
|---|---|---|
| Worker crash | provider exit hook + missed heartbeats | STOPPED/FAILED or UNHEALTHY; sessions recover; alert |
| Notebook termination | missed heartbeats | UNHEALTHY; sessions WORKER_LOST; top-up request |
| Model load failure | agent reports error count, status | worker not scored as warm; operator sees lastError |
| Gateway down | client connect errors; TRANSPORT test; admin service probe | sessions cannot stream; pair tokens are re-issued on new sessions; service can be restarted from the admin test lab |
| Backend down mid-session | agent heartbeat loop keeps retrying and logs HEARTBEAT_FAILED | when the backend returns, heartbeats resume; worker marked stale meanwhile is cleared by a real recovery action |
| Stuck session | failOrphanedSessions (90 s) | WORKER_LOST end; queue re-entry |
| Budget overrun | budgetSweep | WARN/QUEUE_ONLY/EMERGENCY_STOP per policy |
| Orphaned assignment counters | cleanup + sweep reconciliation | activeSessions reconciled to live assignments |

## Design rules
- Never pretend a failed worker is healthy; UNHEALTHY is control-plane
  owned until a real recovery clears it.
- Every automatic action writes an event or alert; silence is a bug.
- Idempotency on sweeps: repeated ticks are safe; allowance grants are
  idempotent by month; session ends are idempotent by state machine.

## Known gaps (honest)
- The agent heartbeat loop tolerates backend downtime by catching errors,
  but if the loop thread itself dies (unhandled bug), only the 120 s stale
  path notices. A watchdog thread inside the agent is a future hardening.
- Gateway restart drops in-flight pairs; clients currently surface an error
  and the user restarts the session. Automatic pair re-establishment is a
  documented next step.
