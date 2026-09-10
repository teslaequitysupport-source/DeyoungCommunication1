# Observability

Checked: 2026-09-10.

## Structured logs
- Gateway: JSON lines to stdout (captured to .zscripts/gateway.log), one
  event per state change plus sampled chunk counters (audio_c2w/w2c every
  10 chunks) - never per-chunk spam.
- Agent: JSON lines to stdout; file trace at worker-agent/agent.log for
  session chunk accounting; WorkerEvent rows for operational events.
- Control plane: request metrics per route; maintenance tick logs.

## Metrics surfaces
- Admin Overview: fleet counts, session states, queue depth, alerts.
- Admin Workers: heartbeats, telemetry history, last errors.
- Admin Billing: ledger + cost sums (zeros shown as zeros).
- Studio: live P50/P95 RTT, sent/received/underruns, elapsed.

## Alerts (Alert rows, admin panel)
- WORKER_STALE, BUDGET threshold crossings, queue overload, model
  moderation events, security events. Delivery (email/webhook) is a
  documented next step; in-app alerting is real now.

## Tracing
- Per-chunk RTT is the core trace unit; seq numbers correlate a chunk
  across browser, gateway log, and agent trace for incident reconstruction.
