// One-off: create a temporary admin for visual verification, or remove it.
// Usage: bun scripts/temp-admin.ts create|remove
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { hashToken } from "../src/lib/crypto";

const db = new PrismaClient();
const EMAIL = "temp-admin-visual@voxcore-probe.invalid";
const PASSWORD = "Temp-Visual-Admin!2026";

async function main() {
  const mode = process.argv[2] ?? "create";
  if (mode === "remove") {
    const u = await db.user.findUnique({ where: { email: EMAIL } });
    if (u) {
      await db.user.delete({ where: { id: u.id } }); // sessions cascade
      console.log("removed", u.id);
    } else {
      console.log("not found");
    }
    return;
  }
  const existing = await db.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log("exists", existing.id);
    return;
  }
  const u = await db.user.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      name: "Visual Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });
  console.log("created", u.id, "session-token-check", hashToken("x").slice(0, 8));
}

main()
  .catch((e) => {
    console.error(String(e));
    process.exit(1);
  })
  .finally(() => db.$disconnect());
