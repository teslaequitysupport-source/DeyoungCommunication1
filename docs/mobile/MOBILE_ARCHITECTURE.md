# Mobile Architecture

Checked: 2026-09-10. Status: DESIGN, not built. No mobile capability is
claimed as working.

## Modes
- MODE A In-app conversion: the app captures mic audio, streams to the
  platform, plays converted audio in-app. Feasible on both platforms.
- MODE B System/third-party routing: feeding other apps. On Android not
  possible for normal apps; on iOS not possible. Documented UNSUPPORTED.
- MODE C External audio routing: capture from files or other sources and
  convert; share results out. Feasible.

## Shape
- Thin native shells (Kotlin; Swift) reusing the same REST and gateway
  protocols. No second backend.
- The phone is always a CLIENT. Inference happens in the cloud fleet by
  default; local on-device inference is a documented option with hard
  limits (see MOBILE_INFERENCE).

## Why cloud-first on mobile
- Battery and thermal budgets on phones make sustained neural inference
  hostile; the fleet exists for exactly this. The client adapts to network
  quality and degrades honestly (see MOBILE_NETWORKING).
