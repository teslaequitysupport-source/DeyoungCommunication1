# Cost Control

Checked: 2026-09-10.

## Levers
- BudgetPolicy: dailyBudgetCents, monthlyBudgetCents, mode. Modes:
  WARN (allow + alert), QUEUE_ONLY (no new paid capacity; queue users),
  EMERGENCY_STOP (stop paid workers, block paid starts, alert).
- evaluateBudget runs before paid provisioning and before paid worker
  admission in scoring; the sweep re-checks on every maintenance tick.
- CostRecord rows per provider event; the Billing panel sums actuals.
- Free-first scheduling makes free capacity structurally preferred.
- Scale-to-zero makes idle paid cost exactly zero.
- Seeded example policy: $1/day so misconfiguration cannot bleed silently.

## What cost control does NOT do
- It does not invent prices or costs; sums start at zero and grow only
  from recorded events.
- It does not silently degrade paid users' running sessions: QUEUE_ONLY
  blocks new paid capacity, not existing sessions.
