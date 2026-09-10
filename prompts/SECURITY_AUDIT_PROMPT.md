# Security Audit Prompt

Threat-model VOXCORE per docs/33-THREAT-MODEL.md and verify controls:
auth (bcrypt cost, lockout), session cookies (SameSite, HttpOnly, Origin
checks), rate limits (burst them), worker registration (try without
tokens), audit chain (tamper a row in a copy and run the verifier),
metering integrity (attempt client-side credit manipulation), upload
moderation (try an undeclared model), secrets (scan the repo). Report
findings with severity, evidence, impact, mitigation, owner, status.
