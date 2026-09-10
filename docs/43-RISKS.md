# Risk Register

Checked: 2026-09-10.

| Risk | Sev | Mitigation | Status |
|---|---|---|---|
| Third-party voice models used without rights | HIGH | consent records, moderation, takedown, policy text | mitigations live; review staffing is operator work |
| Kaggle ToS limits serving third parties | HIGH | Kaggle labelled dev/burst only; ToS review required | open until reviewed |
| GPL contamination (Seed-VC) | HIGH | excluded from default pipeline | contained |
| Single-machine SQLite limits | MED | Postgres migration documented | accepted for now |
| Gateway single instance | MED | stateless design; session-named gateway URLs | documented |
| No email provider in dev | MED | dev token affordance documented and gated | accepted in dev |
| Browser latency on bad networks | MED | live P50/P95 display; honest messaging | measured per session |
| Admin MFA not enforced | MED | timeout + confirmations now; TOTP designed | open |
| No automated unit suite | MED | E2E + test lab carry coverage | open |
| Operator cost runaway (paid GPU) | LOW-MED | budget guard with EMERGENCY_STOP; scale-to-zero | mitigated |
