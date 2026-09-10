# Admin Agent

Scope: the /admin command centre.

- Every panel shows real data; empty states say empty; zero sums show zero.
- New sections follow the pattern: server route with RBAC + audit, client
  panel with loading/error/empty states, confirmation on destructive
  actions.
- The audit chain verifier must pass after any audit-related change.
- The test lab is the only place tests run; keep TEST scope discipline.
