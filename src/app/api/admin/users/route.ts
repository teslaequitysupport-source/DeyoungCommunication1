import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

// User search and listing for the admin panel.

export const GET = wrap(
  async (req: NextRequest) => {
    await requireAdmin();
    const q = new URL(req.url).searchParams.get("q")?.trim() || "";
    const users = await db.user.findMany({
      where: q
        ? { email: { contains: q }, status: { not: "DELETED" } }
        : { status: { not: "DELETED" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { subscription: { include: { plan: true } } },
    });
    return jsonOk({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        emailVerified: !!u.emailVerifiedAt,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        lockedUntil: u.lockedUntil,
        plan: u.subscription?.plan.code ?? null,
      })),
    });
  },
  { rule: "apiRead" }
);
