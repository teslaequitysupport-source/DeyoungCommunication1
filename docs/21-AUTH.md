# Authentication

Checked: 2026-09-10.

## Users
- Email + password. Passwords hashed with bcrypt cost 12. No plaintext ever
  stored or logged.
- Sessions: HttpOnly, SameSite=strict cookie; Origin/Referer validation on
  mutating requests (CSRF defence in depth); session rows are revocable;
  logout destroys the session.
- Brute force: progressive lockout at 10 failed attempts for 15 minutes,
  SecurityEvent rows for failures and lockouts.
- EMAIL_MODE=none (this environment): verification emails cannot be sent,
  so the dev flow surfaces the verification token in the response. This is
  an honest development-mode affordance, gated to non-production email
  config, and is documented wherever accounts are created.
- Password reset: token flow exists; delivery requires a real mail provider
  (same EMAIL_MODE gate).

## Workers
- One-time registration token (hashed at rest) exchanged for a persist
  token; only the SHA-256 of the persist token is stored. Bearer auth on
  every worker call. Registration requires a provisioned row; arbitrary
  self-registration is impossible.

## Admin
- Same user auth plus role check (RBAC: USER | SUPPORT | ADMIN), separate
  shell and layout, re-confirmation on destructive actions, audit chain on
  every mutation, session timeout policy for admin roles.

## Tokens on the audio path
- The scheduler issues short-lived HS256 gateway tokens per role per
  session; the gateway verifies them locally with the shared secret; no
  database lookup, no long-lived credentials at the edge.
