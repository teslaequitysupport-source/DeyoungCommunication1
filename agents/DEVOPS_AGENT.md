# DevOps Agent

Scope: running the platform.

- Start order: DB -> control plane -> gateway -> worker -> smoke tests
  (TRANSPORT, WORKER_HEALTH, CONVERSION in the test lab).
- Gateway is supervised via POST /api/admin/services/gateway (or
  mini-services locally); never leave it dependent on an operator shell.
- Logs: .zscripts/gateway.log, dev.log, worker-agent/agent.log. Read with
  strings(1) if binary corruption appears.
- Scale-to-zero and budget guard are production requirements; verify them
  after any scheduler change.
