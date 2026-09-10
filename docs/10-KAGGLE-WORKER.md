# Kaggle Worker (ASSISTED)

Checked: 2026-09-10.

## What is true
- Kaggle gives roughly 30 GPU hours per week (T4 or T4x2), a single session
  caps around 12 hours, quota resets weekly, interactive notebooks idle-time
  out. These numbers move; the platform never hard-codes them into behavior.
- Kaggle notebooks have internet and can dial out over WebSocket. The agent
  connects outbound to the control plane and the audio gateway. No inbound
  ports are needed. This is verified with the local agent on the same code
  path; a Kaggle kernel runs the identical script.
- Kaggle does not support supported programmatic launching of interactive
  GPU sessions from our backend. Any claim of autonomous Kaggle launch would
  be false. The provider is therefore classed ASSISTED.

## What the operator does
1. Admin panel, GPU workers, Provision, provider KAGGLE_ASSISTED.
2. The platform issues a one-time registration token and renders a
   paste-ready notebook cell that downloads the agent script from
   /api/agent-script?token=... and runs it with BACKEND_URL set.
3. The operator pastes the cell into a GPU notebook and runs it.
4. The agent registers, heartbeats, and appears in the fleet as a normal
   worker (provider kaggle, costKind FREE).

## What the system does when the notebook dies
- Heartbeats stop. After 120 s the maintenance loop marks the worker
  UNHEALTHY, raises a WORKER_STALE alert, and stops new assignments there.
- Sessions on it end as WORKER_LOST after the 90 s orphan window; queued
  demand re-enters the queue and can trigger capacity top-up.
- Nothing assumes the notebook comes back. That is the correct posture.

## Compliance flags (must not be hidden)
- Kaggle Terms restrict some commercial and third-party-serving uses. Before
  routing real user traffic through Kaggle notebooks, obtain a review of the
  current Terms. Until then, Kaggle capacity is for development, testing,
  and burst capacity, and is labelled as such in the admin UI.
