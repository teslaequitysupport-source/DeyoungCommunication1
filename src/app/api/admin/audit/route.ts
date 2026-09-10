import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { verifyAuditChain } from "@/lib/audit";

// Audit log viewer with server-side filters.

export const GET = wrap(
  async (req) => {
    await requireAdmin();
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || undefined;
    const entries = await db.auditLog.findMany({
      where: action ? { action } : {},
      orderBy: { createdAt: "desc" },
      take: 150,
    });
    return jsonOk({ entries });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async () => {
    await requireAdmin();
    const result = await verifyAuditChain();
    return jsonOk(result);
  },
  { rule: "adminWrite" }
);
