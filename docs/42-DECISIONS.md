# Decision Log

Checked: 2026-09-10.

- D1 Sequential milestone order (user): web core -> desktop -> mobile ->
  live billing. Rationale: the web core exercises every subsystem; desktop
  and mobile reuse it; billing last avoids charging before value.
- D2 Deep engine audit before RVC integration (user). Rationale: license
  and latency claims must be verified, not assumed. DSP tier ships to keep
  the platform real in the meantime.
- D3 Flutterwave as first PSP (user). Rationale: Nigeria-first reach plus
  recurring API; Stripe is unavailable to Nigeria-based businesses.
- D4 socket.io for audio transport. Rationale: identical client code from
  browsers and dial-out notebooks; measured RTT adequate; WebRTC later if
  measurements justify it.
- D5 Outbound-only worker protocol. Rationale: sandboxes and notebooks
  cannot accept inbound connections; outbound-only is universally viable.
- D6 DSP as the always-available engine. Rationale: real signal processing
  with zero license risk beats a fake neural tier; RVC is gated on a real
  runtime, honestly.
- D7 Gateway holds no DB. Rationale: stateless edge, signed tokens, easy
  horizontal scale; the control plane owns all truth.
- D8 Test sessions are first class. Rationale: the failover story must be
  provable without touching customer state.
- D9 Pre-peer chunks are rejected, not dropped (2026-09-10 fix). Rationale:
  silent loss masqueraded as a transport bug; explicit acks surface truth.
- D10 Heartbeat does not override control-plane status (2026-09-10 fix).
  Rationale: an admin drain must survive agent heartbeats.
