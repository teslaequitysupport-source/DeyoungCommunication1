# Admin Audit Chain

Checked: 2026-09-10.

## Design
- AuditLog rows: actor, actorRole, action, targetType, targetId,
  before/after JSON, IP, createdAt, prevHash, hash.
- hash = SHA-256(prevHash + canonical(row fields)). Genesis row uses a
  fixed zero prevHash.
- The admin Audit panel lists entries and runs a verifier: recompute the
  chain in order; any mismatch marks the first broken row.

## Properties
- Tamper-evidence: editing or deleting a row breaks every later hash.
- Completeness: every admin mutation writes an entry in the same request
  (transactionally best-effort with explicit failure logging).

## Limits (honest)
- The chain proves order and integrity, not non-repudiation against a
  fully compromised DB host; for that, ship periodic anchored digests
  (documented next step).
