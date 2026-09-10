# Research Summary

Checked: 2026-09-10. Sources recorded in 03-RESEARCH-SOURCES.md.

## Voice conversion engines
- RVC (Retrieval-based Voice Conversion): MIT licensed code; pretrained base
  models are permissively licensed per the annotated-RVC audit by gudgud96.
  Third-party .pth voice models have UNKNOWN rights by default and must be
  audited per model. Real-time use is well established in the ecosystem.
- Applio (IAHispano): MIT licensed RVC fork, active maintenance, commercial
  use permitted under MIT. Verified 2026-09-10 via repository and applio.org.
- w-okada voice-changer (VCClient): MIT licensed real-time client, proven
  real-time pipeline, tunable chunk and extra buffer, Windows/Mac.
- Seed-VC: GPL-3.0. Zero-shot conversion from a short reference clip, ~300 ms
  algorithmic delay plus ~100 ms device side delay (project README). GPL-3.0
  would force the whole product open source if used as-is in a closed SaaS.
  Decision: NOT used in the default pipeline; would require process
  isolation under GPL terms and legal review before any commercial use.
- DDSP-SVC: open source singing voice conversion, lighter weight; kept as a
  future candidate, not integrated.

## Free GPU capacity
- Kaggle: approximately 30 GPU hours per week, single session cap around
  12 hours, T4 and T4x2 available, quota resets weekly. Interactive idle
  timeouts will terminate notebooks. Verdict: legitimate but NOT 24/7
  infrastructure. Termination must be treated as normal failure and recovered
  by another worker. Kaggle ToS restrictions on serving third-party traffic
  are flagged as a compliance risk requiring review before any production use
  (see 26-COMPLIANCE.md).
- Hugging Face ZeroGPU: quota based, not persistent workers, not suitable as
  production capacity. Verdict: NOT SUITABLE for the fleet.
- Google Colab: similar constraints to Kaggle, no programmatic session
  guarantee. Verdict: FREE FOR DEVELOPMENT only.

## Paid GPU (later phase, cost-guarded)
- Modal, RunPod: per-second billing, programmatic start/stop, suitable for
  the provider interface. No credentials are configured; no prices are stated
  here because they change; the cost model doc explains the decision math.

## Payments (Nigeria context)
- Stripe is unavailable to Nigeria-based businesses (verified 2026-09-10).
- Flutterwave selected as the target rail: recurring payments API, cards and
  local methods, documented webhooks. Paystack remains a plausible second
  adapter behind the same interface.

## Transport
- WebSocket (socket.io) chosen for client-to-worker audio in this milestone:
  works everywhere including sandboxed notebooks that dial out, trivially
  deployable, and measured adequate (loopback chunk RTT P50 3 ms). WebRTC
  peer connections are the documented next step for browser-to-browser
  grade jitter handling and are NOT claimed as implemented.
