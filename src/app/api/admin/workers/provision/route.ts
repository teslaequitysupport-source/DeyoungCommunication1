import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { provisionSchema } from "@/lib/validate";
import { getProvider, AVAILABLE_PROVIDERS } from "@/lib/provision";
import { audit } from "@/lib/audit";
import { evaluateBudget } from "@/lib/budget";

// Provision capacity through a provider. LOCAL returns a spawned agent;
// KAGGLE_ASSISTED returns a paste-ready notebook cell plus an honest
// explanation of what is autonomous versus assisted.

export const POST = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const body = provisionSchema.parse(await req.json());
    const meta = await clientMeta();

    const provider = db.provider.findUnique === undefined ? null : null;
    void provider;

    // Paid providers require a budget check; free ones do not.
    const costKind = body.providerCode === "LOCAL" || body.providerCode === "KAGGLE_ASSISTED" ? "FREE" : "PAID";
    if (costKind === "PAID") {
      const decision = await evaluateBudget({ needPaidWorker: true, providerCode: body.providerCode });
      if (!decision.allowed) {
        return jsonOk({ error: { code: "BUDGET", message: decision.reason } }, { status: 409 });
      }
    }

    const impl = getProvider(body.providerCode);
    const result = await impl.provision({ name: body.name || "", tier: body.tier, requestedBy: admin.id });
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: "WORKER_PROVISIONED", targetType: "Worker", targetId: result.workerId ?? null, after: { provider: body.providerCode, tier: body.tier }, ip: meta.ip });
    return jsonOk({ ok: true, ...result, providers: AVAILABLE_PROVIDERS });
  },
  { rule: "adminWrite" }
);

export const GET = wrap(
  async () => {
    await requireAdmin();
    const providers = await db.provider.findMany();
    const requests = await db.provisionRequest.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
    return jsonOk({
      providers: providers.map((p) => ({ ...p, config: p.config ? JSON.parse(p.config) : null })),
      catalog: AVAILABLE_PROVIDERS,
      requests: requests.map((r) => ({ id: r.id, providerCode: r.providerCode, status: r.status, createdAt: r.createdAt, expiresAt: r.expiresAt, assumedById: r.assumedById, script: r.script })),
    });
  },
  { rule: "apiRead" }
);
