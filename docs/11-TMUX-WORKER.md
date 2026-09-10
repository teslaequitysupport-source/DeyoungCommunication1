# tmux and Worker Process Management

Checked: 2026-09-10.

tmux is useful for humans inspecting worker processes; it is not
infrastructure persistence and this project never treats it as such.

## Where tmux fits
- On a self-managed VPS, running the agent inside tmux gives operators a
  detachable terminal, scrollback for debugging, and easy restart scripts.
- The agent is a plain foreground process; wrapping it in tmux changes
  nothing about its behaviour or registration.

## Where tmux does NOT fit
- Cloud notebooks: when Kaggle terminates the kernel, tmux dies with the
  machine. No terminal multiplexer prevents provider termination.
- As a supervision primitive: the platform's supervisor is the control
  plane itself (heartbeats, stale detection, commands), not tmux.

## Recommended operator pattern (self-managed hosts)
1. tmux new -s worker-agent
2. BACKEND_URL=... WORKER_REG_TOKEN=... python3 worker_agent.py
3. Ctrl-b d to detach; tmux attach -t worker-agent to inspect.
4. Restart by re-provisioning a token from the admin panel; the old worker
   record goes UNHEALTHY on its own.
