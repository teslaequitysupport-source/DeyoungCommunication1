# Worker Protocol

Checked: 2026-09-10. Implementations: src/app/api/worker/*,
worker-agent/worker_agent.py.

## Registration
1. Operator provisions a worker; the control plane creates a Worker row
   (status BOOTING) and a ProvisionRequest holding a hashed one-time token
   (1 hour expiry).
2. The agent POSTs /api/worker/register with the one-time token.
3. The server validates the hash, marks the request ASSUMED, returns a
   persist token. Only the SHA-256 of the persist token is stored.
4. All subsequent calls use Authorization: Bearer <persist token>.

## Heartbeat
- POST /api/worker/heartbeat every HEARTBEAT_SEC (~20 s): status,
  activeSessions, CPU/RAM (psutil), GPU telemetry when available,
  inferP50/P95 over the recent window, errorCount, uptime, loadedModels.
- Control-plane-owned statuses (DRAINING, STOPPING, QUARANTINED, UNHEALTHY,
  STOPPED, FAILED) are NOT overwritten by agent heartbeats; liveness
  (lastHeartbeatAt) always refreshes. Fixed 2026-09-10: previously an agent
  heartbeat could clobber an admin drain.

## Commands (outbound-only: the agent polls)
- PING: liveness round trip, agent returns pong with its status.
- START_SESSION: payload sessionId, gatewayLocal, gatewayRemote, modelId;
  the agent dials the gateway URLs in order, authenticates with the signed
  token (worker role), and waits for session-start.
- STOP_SESSION: signals the session loop to stop.
- RUN_TEST_JOB: real conversion of a provided PCM buffer; returns infer ms
  and output size; used by the CONVERSION test lab test.
- SHUTDOWN / RESTART: lifecycle; agent exits or respawns cleanly.
- Every command completes with result or error; completion is audited.

### Delivery semantics (fixed 2026-09-11)
Delivery is at-least-once within a bounded lifetime. The original design
marked a command DELIVERED on handoff and never revisited it, so a lost
poll response or a lost result POST wedged the command forever (observed
live: a PING stuck DELIVERED while later commands completed). Current
behaviour, implemented in src/lib/worker-commands.ts:
- A DELIVERED command with no completion for 30 s is redelivered on the
  next poll (fresh deliveredAt stamp each cycle).
- Any command unresolved 10 minutes after creation is EXPIRED.
- The agent retries the result POST up to 3 times with backoff, so a
  transient backend stall heals in seconds instead of waiting for
  redelivery (worker_agent.py complete_command).
- Because redelivery can repeat work, START_SESSION is idempotent on the
  agent: a repeated START_SESSION for an already-running session is
  ignored (SESSIONS map check).
- The WORKER_HEALTH test-lab wait is 45 s, covering one lost ack plus a
  full redelivery cycle; a healthy PING round trip is a few seconds
  (measured 7 s including poll interval, 2026-09-11).

## Session streaming (gateway, socket.io)
- Agent connects (websocket), emits auth {token} (worker role), waits for
  session-start, then handles audio-in {seq, ts, audio} and emits audio
  {seq, audio} back. Frames arrive at a 128 ms cadence.
- The agent emits from within its receive handler; conversion is fast
  (DSP ~0.2 ms per chunk); failures are counted and logged, never silent.
- Chunk-level tracing lands in worker-agent/agent.log every 10 chunks
  (recv/emit counters with seq and infer time). Added 2026-09-10.

## Rules
- No unauthenticated registration (one-time token required).
- No inbound connections from the control plane to workers, ever.
- A worker that cannot serve a tier says so (WORKER_CANNOT_SERVE_TIER).
