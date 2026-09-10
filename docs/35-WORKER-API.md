# Worker API

Checked: 2026-09-10. Bearer persist token on every call.

- POST /api/worker/register {oneTimeToken, hardware:{...}} -> {workerId,
  persistToken}. One-time; provision request expires in 1 hour.
- POST /api/worker/heartbeat {status, activeSessions, cpuUtilPct,
  ramUsedMb, gpuUtilPct?, vramUsedMb?, inferP50Ms?, inferP95Ms?,
  errorCount, uptimeSec, loadedModels[]} -> {ok, serverTime}.
  Control-plane-owned statuses are preserved server side.
- GET /api/worker/commands -> queued commands (POLL). The agent completes:
  POST /api/worker/commands/:id/complete {ok, result?, error?}.
- POST /api/worker/events {level, kind, message, data} -> operational
  event rows surfaced in the admin Workers panel.
- POST /api/worker/session-ready {sessionId, accepted, error?} ->
  acknowledges or rejects a START_SESSION.
- Gateway (signed short token, role worker): auth, audio-in receive,
  audio emit, session-start / session-ended / peer-lost events,
  end-session with ack.

Rules: no unauthenticated calls; commands are completed exactly once;
rejected sessions report an error string for the audit trail.
