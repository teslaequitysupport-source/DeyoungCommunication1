# Definition of Done

Checked: 2026-09-10. A feature is DONE only when every box is checked.

Per feature:
- [x] IMPLEMENTED: real logic, no placeholder paths in production surfaces.
- [x] TESTED: covered by the E2E suite, a test lab kind, or a documented
      manual procedure with results recorded.
- [x] SECURED: Zod validation, rate rule, auth check, audit where admin.
- [x] ACCESSIBLE: labels, keyboard paths, contrast-safe status text.
- [x] BENCHMARKED where the claim involves performance; numbers recorded in
      32-BENCHMARKS.md with dates.
- [x] DOCUMENTED in /docs with the date and honest limits.
- [x] LICENSE-REVIEWED where third-party code or models are involved.
- [x] PRIVACY-REVIEWED for new data collection (answer the seven questions).
- [x] FAILURE-TESTED: the failure path is exercised (drain, stale, reject).
- [x] RECOVERY-TESTED where the feature claims self-healing.

Platform-level gates before any public launch (61):
- [ ] External security audit (not yet done).
- [ ] Accessibility audit with assistive tech users (not yet done).
- [ ] Legal/compliance review and NDPC posture (not yet done).
- [ ] Load test at target concurrency (not yet done).
- [ ] Real-email flows replacing dev affordances (not yet done).

Everything shipped in this milestone passes the per-feature gate; the
platform-level gates above are explicitly OPEN and are the launch blockers.
