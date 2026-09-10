# API Spec (User and Public Surface)

Checked: 2026-09-10. Envelope: {ok, ...} or {error:{code, message}}.
All mutating routes: Zod validated, rate limited, Origin checked.

## Auth
- POST /api/auth/register {email, password} -> creates account; EMAIL_MODE
  none returns a dev verification token (documented, non-prod only).
- POST /api/auth/login {email, password} -> session cookie; lockout after
  10 failures for 15 min.
- POST /api/auth/logout; GET /api/auth/me.

## Models
- GET /api/models -> APPROVED models visible to the caller.
- POST /api/models (upload, multipart) -> PENDING_REVIEW; rights
  declaration required; rate limited 6/hour.
- POST /api/models/:id/report (abuse) -> queues moderation event.

## Sessions
- POST /api/sessions {modelId, requestedTier} -> ASSIGNING result with
  gatewayToken + gatewayUrls, or QUEUED position, or typed 409.
- POST /api/sessions/:id/metrics {p50Ms, p95Ms, packetsSent,
  packetsReceived, dropsPct}; POST /api/sessions/:id/end.

## Billing (deferred live charges)
- GET /api/billing/me -> plan, subscription, credit balance, usage.
- POST /api/billing/credits/purchase-intent -> PSP adapter call (409 until
  configured). No client-side success states are ever trusted.

## Support
- POST /api/support/tickets {subject, body}; GET /api/support/tickets;
  POST /api/support/tickets/:id/replies {body, internal:false}.

## Health
- GET /api/health -> {status, db:{ok, latencyMs}}; rate limited.

## Worker API (see 35) and Admin API (see ADMIN_* docs) are documented in
their own files. Idempotency: ledger and allowance endpoints require
idempotency keys; session end is idempotent by state machine.
