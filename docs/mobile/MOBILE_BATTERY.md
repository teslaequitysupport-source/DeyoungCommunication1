# Mobile Battery and Thermal (Design)

Checked: 2026-09-10.

- Streaming keeps the radio hot; expect measurable drain. The design keeps
  the phone a thin client precisely to avoid sustained neural compute.
- Quality/performance modes: frame batching (256 ms frames) halves overhead
  at a latency cost; exposed as a user setting with honest labels.
- Thermal: on warnings, drop to larger frames or pause; never claim
  unrestricted sustained capture.
- No battery numbers are claimed here; they get measured on devices.
