# Privacy and Data Minimisation

Checked: 2026-09-10.

## Data inventory (the whole list)
- Account: email, password hash, role, timestamps.
- Sessions/devices: session rows, IP and user agent on security events only.
- Usage: session lifecycle rows, latency metrics (numbers, not audio),
  usage records, credit ledger entries.
- Voice models: metadata, license notes, consent records, moderation state.
- Support: tickets and messages the user writes.
- Operations: worker telemetry, audit chain, security events, alerts.

## What is never collected
- Real-time audio is not recorded server side. Chunks transit memory and
  are dropped. No analytics SDK, no third-party trackers, no ads, no
  fingerprinting, no external fonts.

## Rights supported in code
- Export: account + usage export endpoint (JSON) for the requesting user.
- Deletion: account deletion cascade with documented exceptions (audit and
  security records retained for legal basis; ledger retained anonymised).
- Consent: ConsentRecord rows for voice uploads and cloning declarations;
  withdrawal triggers takedown review of the linked model.

## Retention
See 20-STORAGE.md. Sweeps run automatically in the maintenance loop.

## Nigeria NDPA posture
- Lawful basis recorded per processing purpose; data minimisation by design;
  retention schedules documented; breach alerting exists (alerts table).
  A formal NDPC registration/compliance review by a professional is
  REQUIRED before production launch; this build does not claim compliance.
