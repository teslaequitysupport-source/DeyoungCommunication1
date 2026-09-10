# VOXCORE Documentation Index

Checked: 2026-09-10. 68 documents. Every claim that can change carries the
date it was checked. Nothing here claims legal compliance, untested mobile
capability, or performance that was not measured on this machine.

## Core
00 Vision | 01 PRD | 02 Research | 03 Research Sources | 04 Requirements |
05 Architecture | 06 System Design | 07 Audio Pipeline | 08 Voice Model
Research | 09 GPU Research

## Platform engineering
10 Kaggle Worker | 11 tmux | 12 Worker Protocol | 13 Worker Scheduler |
14 Failover | 15 Self-Healing | 16 Networking | 17 Desktop App |
18 Virtual Microphone | 19 Backend | 20 Storage | 21 Auth | 22 Security |
23 Privacy | 24 License Audit | 25 Model License Audit | 26 Compliance

## Business and operations
27 Billing | 28 Cost Model | 29 Scaling | 30 Observability | 31 Testing |
32 Benchmarks | 33 Threat Model | 34 API Spec | 35 Worker API |
36 Desktop API | 37 Database Schema | 38 Deployment | 39 Development |
40 Troubleshooting | 41 Roadmap | 42 Decisions | 43 Risks |
44 Open Questions | 45 Definition of Done

## Scaling set
SCALE-TO-ZERO | WORKER-LIFECYCLE | COST-CONTROL | PROVIDER-ABSTRACTION |
BILLING-USAGE

## Admin set
ADMIN_ARCHITECTURE | ADMIN_SECURITY | ADMIN_FEATURES | ADMIN_AUDIT |
ADMIN_CUSTOMIZATION | ADMIN_TESTING

## Mobile set (design, not built; statuses are platform-capability
statements, not claims)
MOBILE_ARCHITECTURE | ANDROID_ARCHITECTURE | IOS_ARCHITECTURE |
MOBILE_AUDIO | MOBILE_NETWORKING | MOBILE_INFERENCE | MOBILE_COMPATIBILITY
| MOBILE_BATTERY | MOBILE_SECURITY | MOBILE_PRIVACY | MOBILE_TESTING

## Verification evidence (2026-09-10)
- E2E audio: 30/30 chunks, gateway RTT P50 3 ms P95 6 ms (twice).
- Failover: orphaned TEST session recovered in ~100 s; worker READY again.
- Rate limit: burst of 360 produced exactly 240 x 200 and 120 x 429.
- Scale-to-zero: zero paid workers running with a live free fleet.
- Lint: clean.
