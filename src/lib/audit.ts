import crypto from "crypto";
import { db } from "@/lib/db";

// Tamper-resistant audit trail. Each entry embeds the hash of the previous
// entry so removal or retro-editing breaks the chain. The chain is verified by
// the admin audit view (POST /api/admin/audit/verify recomputes the chain).

export interface AuditInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function audit(input: AuditInput): Promise<void> {
  try {
    const last = await db.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { hash: true } });
    const prevHash = last?.hash ?? "GENESIS";
    // Timestamp is application-provided so verification can recompute the exact hash.
    const at = Date.now();
    const payload = JSON.stringify({
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      at,
    });
    const hash = crypto.createHash("sha256").update(prevHash + payload).digest("hex");
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        before: input.before !== undefined ? JSON.stringify(input.before) : null,
        after: input.after !== undefined ? JSON.stringify(input.after) : null,
        reason: input.reason ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        prevHash,
        hash,
        createdAt: new Date(at),
      },
    });
  } catch (e) {
    // Audit failures must never break the request path, but they must be loud.
    console.error(JSON.stringify({ level: "error", msg: "audit_write_failed", action: input.action, err: String(e) }));
  }
}

export interface SecurityEventInput {
  kind: string;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  severity?: "INFO" | "WARN" | "CRITICAL";
  detail?: unknown;
}

export async function securityEvent(input: SecurityEventInput): Promise<void> {
  try {
    await db.securityEvent.create({
      data: {
        kind: input.kind,
        userId: input.userId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        severity: input.severity ?? "INFO",
        detail: input.detail !== undefined ? JSON.stringify(input.detail) : null,
      },
    });
    if (input.severity === "CRITICAL") {
      await db.alert.create({
        data: {
          kind: "SECURITY_CRITICAL",
          severity: "CRITICAL",
          title: `Security event: ${input.kind}`,
          detail: JSON.stringify(input.detail ?? {}),
          sourceRef: input.userId ?? input.ip ?? null,
        },
      });
    }
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "security_event_write_failed", kind: input.kind, err: String(e) }));
  }
}

// Verify the audit chain integrity. Recomputes every hash exactly.
export async function verifyAuditChain(limit = 5000): Promise<{ ok: boolean; brokenAt: string | null; checked: number }> {
  const rows = await db.auditLog.findMany({ orderBy: { createdAt: "asc" }, take: limit });
  let prevHash = "GENESIS";
  for (const row of rows) {
    if (row.prevHash !== prevHash) {
      return { ok: false, brokenAt: row.id, checked: rows.length };
    }
    const payload = JSON.stringify({
      actorId: row.actorId,
      actorRole: row.actorRole,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      before: row.before,
      after: row.after,
      reason: row.reason,
      ip: row.ip,
      at: row.createdAt.getTime(),
    });
    const expected = crypto.createHash("sha256").update(prevHash + payload).digest("hex");
    if (row.hash !== expected) {
      return { ok: false, brokenAt: row.id, checked: rows.length };
    }
    prevHash = row.hash;
  }
  return { ok: true, brokenAt: null, checked: rows.length };
}
