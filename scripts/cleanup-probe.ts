// Remove probe users created by scripts/probe-register.sh.
// All User relations are onDelete: Cascade (authSession, verificationToken,
// consentRecord, subscription, notification), so one delete cleans up.
// Audit/security events are intentionally LEFT (append-only trail).
// Usage: DATABASE_URL=<url> bun scripts/cleanup-probe.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const users = await db.user.findMany({
  where: { email: { contains: "@voxcore-probe.invalid" } },
  select: { id: true, email: true },
});

for (const u of users) {
  await db.user.delete({ where: { id: u.id } });
  console.log(`deleted ${u.email} (${u.id})`);
}

if (users.length === 0) console.log("no probe users found");
await db.$disconnect();
