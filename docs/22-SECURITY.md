# Security

Checked: 2026-09-10.

## Controls implemented
- Input validation: Zod schemas on every mutating endpoint; unknown fields
  stripped; types enforced at the boundary.
- XSS: React escaping by default; no dangerouslySetInnerHTML in product
  surfaces; CSP headers set at the edge config for dev parity.
- CSRF: SameSite=strict session cookies plus Origin/Referer checks on
  mutations; state-changing APIs reject cross-site origins.
- Injection: Prisma parameterised queries only; no string-built SQL.
- Path traversal: uploads normalised and confined; filename randomisation.
- Session security: HttpOnly + SameSite=strict; secure flag in prod; idle
  timeout for admin; session revocation on logout and password change.
- Rate limits (DB-backed fixed window, shared):
  | area | rule | limit |
  |---|---|---|
  | login | authLogin | 10 / 300 s |
  | register | authRegister | 5 / 3600 s |
  | password reset | authPasswordReset | 5 / 3600 s |
  | api read | apiRead | 240 / 60 s |
  | api write | apiWrite | 60 / 60 s |
  | session start | sessionStart | 10 / 300 s |
  | model upload | modelUpload | 6 / 3600 s |
  | worker register | workerRegister | 30 / 300 s |
  | worker heartbeat | workerHeartbeat | 30 / 60 s |
  | admin write | adminWrite | 120 / 60 s |
  | test lab | testLab | 20 / 60 s |
  Verified 2026-09-10: burst of 360 -> exactly 240 allowed, 120 x 429.
- Worker impersonation: one-time tokens, hashed persist tokens, provision
  request expiry, worker rows cannot self-create.
- Audit tamper resistance: hash chain (each row embeds the previous hash);
  the admin Audit panel verifies the chain on demand.
- Secrets: .env only; no secrets committed; gateway secret and NextAuth
  secret configurable per environment; dev defaults are labelled dev-only.

## Threat model summary (full: 33-THREAT-MODEL.md)
Key threats addressed: credential stuffing (lockout + limits), session
hijack (strict cookies, Origin checks), worker impersonation (token flow),
billing manipulation (server-authoritative metering, idempotent ledger),
admin takeover (RBAC + audit + confirmations), malicious uploads
(moderation gate + scan before approval), audio privacy (no persistence).

## Known limitations (honest)
- SQLite in dev is not a production security boundary for concurrency.
- The dev-mode verification token display (EMAIL_MODE=none) must be disabled
  in any real deployment.
- Admin MFA is designed (session timeout + confirmations) but not yet
  TOTP-enforced; documented as a gap, not a feature.
