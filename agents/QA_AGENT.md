# QA Agent

Scope: verification and regression.

- Run scripts/verify-suite.sh (or its parts) before any release claim:
  E2E audio, failover, rate limit, scale-to-zero, worker health.
- Evidence or it did not happen: paste the actual outputs into TestRun or
  the worklog. No invented greens.
- Test failure paths deliberately: kill the agent, drain mid-session,
  break the gateway, exhaust rate limits.
- Keep scripts/cleanup-stale.ts as the pre-run hygiene gate.
- Record results in docs/31-TESTING.md with dates.
