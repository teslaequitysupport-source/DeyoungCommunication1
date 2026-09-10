# Mobile Security (Design)

Checked: 2026-09-10.

- Tokens: the same short-lived gateway tokens; refresh via re-auth only.
- Storage: session tokens in the platform keystore/keychain; nothing in
  plaintext prefs.
- Transport: TLS with certificate pinning considered for release builds.
- Attestation: Play Integrity / App attestation evaluated at launch; not
  assumed to be unspoofable; server-side rate limits remain the backstop.
- Logging: no audio, no tokens in logs; crash reports scrubbed.
