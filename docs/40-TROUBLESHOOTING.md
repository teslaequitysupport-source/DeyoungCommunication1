# Troubleshooting

Checked: 2026-09-10. Real incidents and their fixes from this build.

## Sessions stuck CONNECTING
- Cause: the assigned worker row is stale (agent died) or the agent cannot
  reach the gateway URLs.
- Fix: cleanup-stale.ts; verify the agent process; check gatewayLocal
  reachability (ws://127.0.0.1:3003 locally); the agent tries
  gatewayRemote next.

## Audio flows partially (N of 30 chunks)
- Cause (fixed 2026-09-10): the client streamed before the worker joined
  the pair and the gateway silently dropped pre-peer chunks.
- Fix: clients wait for peer-ready; the gateway now acks false instead of
  dropping. Verify with worker-agent/agent.log recv/emit counters and
  gateway audio_c2w/audio_w2c counters.

## Worker flips from DRAINING back to IDLE
- Cause (fixed 2026-09-10): agent heartbeats overwrote control-plane
  status. Fix: heartbeat route preserves CONTROL_OWNED statuses; liveness
  still refreshes.

## FAILOVER test never recovers
- Cause: a live worker's fresh heartbeat makes the session look alive, or
  the session is younger than the 90 s staleness window.
- Fix: the maintenance loop requires the assigned worker to be alive AND
  the session older than 90 s; drain state now survives heartbeats.

## Rate limit test shows zero 429s
- Cause: a slow burst straddled two 60 s fixed windows.
- Fix (2026-09-10): the test aligns to a fresh window and fires concurrent
  batches; expect 240 allowed then 429s.

## Gateway health check fails while the port listens
- Cause: socket.io mounts at path "/", hijacking plain /health GETs.
- Fix: probe the engine.io handshake (?EIO=4&transport=polling) - what the
  admin service probe and TRANSPORT test do.

## Prisma validation errors after schema edits
- Cause: a long-lived dev server holds a stale client.
- Fix: db.ts schema-stamp detects mtime changes; restart dev if needed.

## Gateway logs unreadable
- Cause: bun --hot wrote binary garbage to the log once.
- Fix: read with strings(1); prefer starting the gateway without --hot for
  long runs, or via the control-plane spawn (plain bun).
