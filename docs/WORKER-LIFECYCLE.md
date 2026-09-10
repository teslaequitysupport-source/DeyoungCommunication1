# Worker Lifecycle

Checked: 2026-09-10.

## States (directive-mandated set)
BOOTING -> LOADING_MODEL -> WARMING -> READY -> ACTIVE -> IDLE ->
DRAINING -> STOPPING -> STOPPED, plus UNHEALTHY, FAILED, RESTARTING,
QUARANTINED.

## Transitions
- Provision creates BOOTING + a one-time token.
- Agent registration -> READY (after first heartbeat).
- Assignment -> ACTIVE; last session end -> IDLE.
- Admin drain -> DRAINING (control-plane owned; agent heartbeats cannot
  clear it, fixed 2026-09-10).
- Stale heartbeat (120 s) -> UNHEALTHY + alert.
- SHUTDOWN command -> STOPPING -> STOPPED; provider exit hook -> FAILED on
  nonzero exit with lastError.
- Recovery: operator restart or provider restart; agent heartbeats resume;
  a real recovery action clears UNHEALTHY to READY. Quarantine is manual.

## Honest note
States reflect what the control plane KNOWS (heartbeats, commands, exits),
not what it hopes. A worker is healthy only while evidence says so.
