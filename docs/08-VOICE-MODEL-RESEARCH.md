# Voice Model Research

Checked: 2026-09-10.

## Ecosystem scan
- RVC family (RVC WebUI, Applio, w-okada client): the de facto standard for
  real-time .pth voice models. MIT licensed tooling; per-model rights vary.
- Seed-VC: zero-shot, GPL-3.0, excluded from the default pipeline (license).
- so-vits-svc: singing focused, non-real-time origin, maintenance cooling.
- DDSP-SVC: lighter, singing, candidate for later integration.
- Beatrice: commercial-friendly claims circulate, but the license requires
  careful reading; not integrated; marked UNVERIFIED.

## What ships in this build
- Three SYSTEM_DSP models seeded with honest params (pitch and formant
  presets). They run on the real DSP engine everywhere, no GPU needed.
- RVC support in the agent code path exists but is dormant until an operator
  installs an RVC runtime and an audited .pth on a worker. The platform will
  not claim RVC compatibility it cannot demonstrate in this environment.

## Voice rights policy (enforced in code)
- User uploads require: declaration of rights, consent record rows, and a
  voice sample consent acknowledgement for cloning flows.
- UPLOAD -> PENDING_REVIEW -> APPROVED | REJECTED | TAKEN_DOWN. Only
  APPROVED models appear in any catalog or session request.
- Abuse reports and takedown are first class; takedown is audited.
- Public figure impersonation is rejected by policy text and by review.

## Per-model audit template
- Repository, code license, weights license, dataset license and consent,
  commercial/SaaS/API/redistribution rights, attribution needs, latency,
  VRAM, streaming support, maintenance status, security notes.
