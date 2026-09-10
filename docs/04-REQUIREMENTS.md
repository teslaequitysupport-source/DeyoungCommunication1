# Requirements Traceability

Checked: 2026-09-10. Maps the directive's demands to what exists.

| Requirement | Status | Where |
|---|---|---|
| Real auth with lockout | DONE | src/lib/auth.ts, security events, bcrypt cost 12 |
| Rate limiting layers | DONE, VERIFIED | src/lib/rate-limit.ts; test lab RATE_LIMIT: 240 allowed, 120 x 429 |
| Worker fleet with heartbeats | DONE, VERIFIED | worker-agent/worker_agent.py, /api/worker/*, psutil telemetry |
| Worker scoring + queue | DONE | src/lib/scheduler.ts |
| Scale-to-zero | DONE, VERIFIED | scheduler.scaleToZero + maintenance sweep; test lab PASS |
| Self-healing | DONE, VERIFIED | stale worker detection (120 s), orphaned session recovery (~100 s observed), alerts |
| Provider abstraction | DONE | src/lib/provision.ts: LocalProvider (AUTONOMOUS), KaggleAssistedProvider (ASSISTED, honestly labelled) |
| Real-time audio path | DONE, VERIFIED | audio gateway + agent; E2E 30/30 chunks, RTT P50 3 ms P95 6 ms |
| Honest engine tiers | DONE | DSP tier runs real numpy DSP; RVC tier errors honestly when no runtime |
| Model moderation + consent | DONE | VoiceModel statuses, VoiceModelEvent, ConsentRecord, AbuseReport |
| Metering + credits | DONE | UsageRecord, CreditLedgerEntry with idempotency, monthly allowance sweep |
| Billing live | DEFERRED by user decision | PSP adapter interface; Flutterwave selected; no live charges |
| Admin command centre | DONE | /admin with 12 sections, separate security model |
| Audit tamper resistance | DONE | AuditLog hash chain with prevHash; verifier in admin Audit panel |
| Site settings workflow | DONE | SiteSetting + SettingVersion, draft/publish, rollback |
| Test lab | DONE, VERIFIED | 6 test kinds, TEST scope only, TestRun records |
| Legal pages | DONE | Terms, Privacy, Cookie, Refund, Cancellation, AUP, Copyright, Voice rights, Contact |
| Compatibility matrices | DONE | docs/22 and docs/mobile/*, honest statuses |
| Windows virtual mic | PARTIAL | architecture documented; no driver bundling claimed |
| Android / iOS clients | NOT BUILT | architecture documented in /docs/mobile |
| Live GPU notebook workers | WORKAROUND | Kaggle assisted notebook cell; termination is treated as normal failure |
