# Threat Model

Checked: 2026-09-10. STRIDE-flavoured, product specific.

## Assets
Credentials and sessions; voice models and consent records; the credit
ledger; worker tokens; audit chain; user audio in transit.

## Actors
Anonymous visitor, authenticated user, paying user (later), worker operator
(ours), admin, and a malicious worker (compromised or rogue notebook).

## Stride highlights
- SPOOFING: rogue worker registration. Mitigation: one-time provision
  tokens, hashed persist tokens, provision request expiry, no self-service
  worker creation. User spoofing: bcrypt + lockout + rate limits.
- TAMPERING: ledger/credits. Mitigation: server-side only mutations,
  idempotency keys, no client-trusted amounts. Audit chain tamper evidence.
- REPUDIATION: admin actions. Mitigation: hash-chained audit with actor,
  target, before/after; chain verifier in the UI.
- INFORMATION DISCLOSURE: audio interception. Mitigation: WSS in prod,
  short-lived signed gateway tokens scoped per session per role, no audio
  persistence. Logs carry counts and seqs, never audio payloads.
- DENIAL OF SERVICE: session floods. Mitigation: sessionStart rate limit,
  plan concurrency caps, queue with priorities, budget guard stops paid
  runaway, scale-to-zero caps idle cost. Health route rate limited (verified
  240 then 429).
- ELEVATION OF PRIVILEGE: user to admin. Mitigation: RBAC checks in every
  admin route, separate admin shell, admin re-confirmation on destructive
  actions, security events on privilege-relevant activity.

## Malicious worker analysis (the interesting one)
A rogue worker cannot: read other sessions (tokens are session-scoped and
role-scoped), write to the DB (only its own worker endpoints), mint credits.
It CAN: mishandle audio it receives (privacy risk inherent to cloud
processing; stated in the privacy policy), or return garbage audio
(quality issue, detected by client-side metrics and user reports).
Mitigation posture: run your own workers only; third-party notebook
capacity requires the ToS review in 26-COMPLIANCE.md.
