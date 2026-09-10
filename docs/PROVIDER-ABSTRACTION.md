# Provider Abstraction

Checked: 2026-09-10. Implementation: src/lib/provision.ts.

## Interface
    provision({name, tier, requestedBy}) -> {workerId?, artifact?, instructions?}
    start(workerId) / stop(workerId) / restart(workerId) /
    terminate(workerId) / drain(workerId)
    healthCheck(workerId) -> {healthy, reason}
    getCapabilities() / getCost() -> metadata

## Shipped providers
- LocalProvider (AUTONOMOUS, FREE): spawns python3 worker_agent.py with
  BACKEND_URL and a one-time token; tracks the child process; exit hooks
  update the worker row. Real process management.
- KaggleAssistedProvider (ASSISTED, FREE): issues the registration token
  and generates a paste-ready notebook cell that downloads the agent
  script via /api/agent-script?token=... and runs it. The UI states
  plainly what is automated and what a human must do.

## Adding RunPod or Modal later
1. Implement the interface with the provider's API SDK (needs credentials
   and a budget check; both providers are PAID class).
2. Map their instance states to the worker lifecycle states.
3. Register in AVAILABLE_PROVIDERS; the admin UI picks it up.
No application code changes: scoring, queueing, top-up and the test lab
work through the interface.
