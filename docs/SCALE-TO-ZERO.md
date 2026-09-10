# Scale to Zero

Checked: 2026-09-10. NON-NEGOTIABLE per the directive; verified by test.

## Lifecycle
    NO DEMAND -> ZERO PAID WORKERS -> USER REQUEST -> PROVISION ->
    BOOT -> LOAD -> HEALTH -> READY -> SESSION -> IDLE -> COOLDOWN ->
    DRAIN -> STOP -> ZERO PAID GPU COST

## Rules implemented (src/lib/scheduler.ts scaleToZero)
- Only PAID workers are ever stopped. FREE workers (local, assisted
  notebooks) are left alone: stopping them saves nothing.
- Never stop a worker with active sessions; never stop a worker that is
  BOOTING mid-start unless the budget policy says EMERGENCY_STOP.
- Cooldown: idle past scaleToZeroCooldownSec before STOP is issued via a
  SHUTDOWN command; the provider marks the row STOPPED.
- Admin override: a worker pinned by an administrator is excluded.

## Verified (2026-09-10)
SCALE_TO_ZERO test lab run: 0 idle paid workers, 0 active paid, 5 free
workers present, emergency stop off. PASS.
