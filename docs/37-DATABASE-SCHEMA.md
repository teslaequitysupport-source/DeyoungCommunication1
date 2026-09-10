# Database Schema

Checked: 2026-09-10. Source of truth: prisma/schema.prisma. SQLite in dev.

## Grouping (about 30 models)
- Identity: User, AuthSession, VerificationToken, Plan, Subscription.
- Money: CreditLedgerEntry (idempotencyKey unique), UsageRecord, CostRecord.
- Voices: VoiceModel, VoiceModelEvent, ConsentRecord, AbuseReport.
- Fleet: Worker, WorkerHeartbeat, WorkerCommand, WorkerEvent,
  WorkerSessionAssignment, Provider, ProvisionRequest.
- Runtime: ConversionSession, QueueEntry, BudgetPolicy.
- Support/comms: SupportTicket, TicketMessage, Notification.
- Governance: AuditLog (hash chain), SecurityEvent, RateLimitCounter,
  SiteSetting, SettingVersion, FeatureFlag, Alert, RequestMetric, TestRun.

## Notable fields
- ConversionSession: isTest, endReason, requestedTier/resolvedTier,
  updatedAt @updatedAt (drives orphan detection).
- Worker: tokenHash (SHA-256 only), status machine, lastHeartbeatAt,
  activeSessions, maxSessions, costKind, providerCode.
- AuditLog: prevHash + hash per row; actor, action, target, before/after.
- db.ts schema-stamp: the client compares schema mtimes and forces a fresh
  PrismaClient after pushes, killing the stale-process bug class.

## Indexes worth knowing
- QueueEntry(status, priority, enqueuedAt); Worker(status, lastHeartbeatAt);
  RateLimitCounter unique (key, windowStart); AuditLog(createdAt).
