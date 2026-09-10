# Admin Security

Checked: 2026-09-10.

## In force
- Role gate on every admin route (server side), separate session timeout,
  audit chain on all mutations, security events for login anomalies,
  re-authentication prompts on destructive flows, confirmation dialogs for
  DELETE USER, DELETE DATA, STOP ALL WORKERS equivalents, billing changes
  and site publishing.
- Rate limits: adminWrite 120/min, testLab 20/min.

## Honest gaps
- MFA (TOTP) is designed but not enforced yet; until then admin accounts
  must use strong unique passwords and the operator must protect the env
  bootstrap credentials.
- IP allowlisting is deployment-level (reverse proxy), not app level.

## Bootstrap
- The seed creates one admin with a strong generated password printed once
  at seed time; change it immediately; the credential in the dev seed
  (admin@voxcore.local) is documented as dev-only.
