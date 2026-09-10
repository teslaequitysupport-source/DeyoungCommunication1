# Storage

Checked: 2026-09-10.

## What is stored where
- Database (SQLite in dev): all control-plane state. No audio blobs.
- Real-time audio: never persisted. Chunks live in memory for the duration
  of the hop (browser -> gateway -> worker) and are gone after playback.
- Studio recordings: created and saved locally in the user's browser
  (WAV blob download). The server never receives them.
- Model files (future RVC .pth uploads): object storage bucket with signed
  URLs, antivirus gate in the upload pipeline, checksums recorded. Not
  active in this environment; the schema and flow exist.

## Retention (enforced by maintenance sweeps)
- WorkerHeartbeat: 24 h. RequestMetric: 24 h. RateLimitCounter: past
  windows pruned. VerificationToken: past expiry (48 h cap).
  ProvisionRequest: 7 d after expiry.
- Voice model uploads: deleted with the model row; consent records are
  retained (legal basis) but decoupled from audio.
- AuditLog and SecurityEvent: retained; they are the compliance record.

## Backups
- Dev: file copy of the DB is acceptable; not automated here.
- Production: managed Postgres with PITR recommended; model object store
  versioning; restore drill documented in 47/48 docs. Nothing in the
  architecture assumes a single provider is permanent.
