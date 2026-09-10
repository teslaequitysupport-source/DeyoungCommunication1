# Architecture

Checked: 2026-09-10.

## Topology

    Browser (studio, AudioWorklet capture/playback)
        |  HTTPS (Next.js API + pages, port 3000 dev)
        v
    Next.js control plane
        - Auth, sessions API, models, billing, support, admin
        - Scheduler (scoring, queue, budget guard)
        - Maintenance loop (stale detection, failover, sweeps)
        - Provisioning (LocalProvider | KaggleAssistedProvider | future)
        |  outbound-only command queue (worker polls)
        v
    Worker agent (python3 worker_agent.py)
        - registers with one-time token, receives persist token (stored hashed)
        - heartbeats: CPU/RAM/GPU telemetry via psutil (real values)
        - polls commands; runs sessions; runs TEST_JOBs for the test lab
        |  dials the gateway (outbound), authenticates with signed token
        v
    Audio gateway (mini-services/audio-gateway, socket.io, port 3003)
        - pairs exactly one client socket and one worker socket per session
        - verifies short-lived HS256 tokens locally (no database)
        - client -> worker: PCM16 chunks; worker -> client: converted PCM16
        - per-chunk RTT measurement; posts summary metrics to control plane
        |  (x-gateway-secret header, internal endpoint)

    SQLite (Prisma) for all control-plane state. Dev: file DB. Prod: swap the
    datasource to Postgres without application changes.

## Key decisions
- D1 Outbound-only workers. Workers dial the control plane and the gateway;
  no inbound ports on worker hosts (works with Kaggle and sandboxes).
- D2 Gateway holds no state of value. Signed short tokens; a gateway restart
  drops pairs but the control plane re-issues tokens on new sessions.
- D3 Real DSP for the free tier. The DSP engine is genuine signal processing
  (granular pitch shift with overlap-add, formant tilt), not a stub, with
  measured per-chunk inference around 0.2 ms on CPU.
- D4 Honest tiers. requestedTier AUTO resolves to DSP_CPU unless an RVC
  runtime exists; RVC tier requests without a runtime fail with a clear
  error rather than degrading silently.
- D5 Provider abstraction. Two providers ship (local autonomous, Kaggle
  assisted). Kaggle is labelled ASSISTED everywhere: a human pastes a
  notebook cell; the platform does not pretend to launch it.
- D6 Server-authoritative metering. Session state transitions happen in the
  control plane; the client reports latency metrics but cannot grant itself
  time or credits.
- D7 Admin is separate. /admin has its own shell, stricter rules, audit
  chain, and confirmation gates for destructive actions.

## Data flow for one spoken chunk
1. AudioWorklet captures 128 ms at 16 kHz, converts to PCM16, emits audio
   with a monotonically increasing seq (only after peer-ready).
2. Gateway assigns its own seq, records pending timestamp, forwards
   audio-in to the paired worker socket.
3. Agent converts (DSP engine or RVC when available) and emits audio back
   with the original seq.
4. Gateway matches seq to the pending map, records RTT, forwards audio-out
   to the client; playback worklet queues and plays.
5. On session end the gateway posts P50/P95 and drop percentages to the
   control plane; the studio also reports browser-measured stats.
