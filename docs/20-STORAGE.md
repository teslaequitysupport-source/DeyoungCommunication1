# Storage

Checked: 2026-09-14.

## What is stored where
- Database (PostgreSQL in production): all control-plane state plus voice
  clone sample audio (bytea). No other audio blobs.
- Real-time audio: never persisted. Chunks live in memory for the duration
  of the hop (browser -> gateway -> worker) and are gone after playback.
- Studio recordings: created and saved locally in the user's browser
  (WAV blob download). The server never receives them.
- Model files (.pth uploads): written to `VOXCORE_UPLOAD_DIR` (default
  `.data/uploads`) on the deployment disk. This is EPHEMERAL on Railway
  unless a volume is attached; the DB always keeps name, size and sha256,
  so a cleared file is detectable and the model can simply be re-uploaded.
  Attach a Railway volume (mount /data) and set
  `VOXCORE_UPLOAD_DIR=/data/models` for persistence. The file is never
  executed or parsed server-side; uploads are sniffed (zip/pickle magic
  bytes) and hash-sealed on arrival.
- Voice clone samples (device uploads): stored as Postgres bytea, so they
  survive redeploys without a volume. Capped at MAX_SAMPLE_UPLOAD_MB (12MB
  default) per file, max 3 files per request, max 10 open requests per
  user. Content-verified by container magic bytes (wav/mp3/m4a/ogg/flac/
  webm), SHA-256 hashed, private to the account, deletable by the owner.

## Retention (enforced by maintenance sweeps)
- WorkerHeartbeat: 24 h. RequestMetric: 24 h. RateLimitCounter: past
  windows pruned. VerificationToken: past expiry (48 h cap).
  ProvisionRequest: 7 d after expiry.
- Voice model uploads: deleted with the model row; consent records are
  retained (legal basis) but decoupled from audio.
- Voice clone samples: cascade-deleted with their request row; the owner
  deletes via the Voices page, and account deletion removes everything.
- AuditLog and SecurityEvent: retained; they are the compliance record.

## Backups
- Dev: file copy of the DB is acceptable; not automated here.
- Production: managed Postgres with PITR recommended; model object store
  versioning; restore drill documented in 47/48 docs. Nothing in the
  architecture assumes a single provider is permanent.
