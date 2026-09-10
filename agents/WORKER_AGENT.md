# Worker Agent Developer

Scope: worker-agent/worker_agent.py and the worker API.

- The agent must stay dependency-light (numpy, psutil, requests,
  python-socketio) so it runs in notebooks.
- Outbound-only. Registration with one-time tokens; persist token kept in
  memory; heartbeats must tolerate backend downtime (catch, log, retry).
- Honest tiers: report capability truthfully; never answer RVC jobs
  without a real runtime; count and log every conversion failure.
- Chunk-level trace to agent.log every 10 chunks per session.
- Test changes with the E2E suite (scripts/e2e-audio.ts) before declaring
  success; watch recv/emit counters for loss.
