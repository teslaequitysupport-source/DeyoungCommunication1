# Roadmap

Checked: 2026-09-10. Sequential (user decision): web core first, then
desktop, then mobile, then live SaaS billing.

## Shipped (this milestone)
- Web studio with real-time conversion, recording, latency stats.
- Control plane: auth, models + moderation, sessions, metering, credits,
  support, notifications, settings, budgets, admin command centre, test lab.
- Fleet: local autonomous provider, Kaggle assisted provider, scheduler,
  scale-to-zero, self-healing, audit chain.
- Docs, agents, prompts sets.

## Next
1. Desktop shell (Tauri) + virtual microphone flow (Windows first) with the
   compatibility matrix filled from real tests.
2. RVC runtime integration behind the honest tier gate on a GPU worker.
3. Automated browser tests for the studio; load tests for the gateway.
4. Email provider integration (EMAIL_MODE=smtp) to retire the dev token
   affordance.

## Then
5. Android app (Mode A in-app conversion first; cloud path).
6. iOS app (Mode A; AVAudioEngine + mute-adjacent constraints documented).
7. Flutterwave live rails (sandbox then live) once pricing and legal are
   final; Paystack adapter behind the same interface.
8. WebRTC transport option where it beats WebSocket in measurement.
