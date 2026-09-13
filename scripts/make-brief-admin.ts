// Creates (or resets) a temporary ADMIN probe user for browser-verifying the
// operator brief. Deleted again by cleanup. Probe domain is cascade-cleaned
// by scripts/cleanup-probe.ts as well.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeDatabaseUrl } from "../scripts/boot-lib";

// Standalone scripts do NOT inherit boot.ts's in-process env repair, so the
// raw DATABASE_URL (raw # $ , ) & in the password) must be normalized here.
const repaired = normalizeDatabaseUrl(process.env.DATABASE_URL ?? "").url;
process.env.DATABASE_URL = repaired;

const db = new PrismaClient();
const email = "brief-admin-probe@voxcore-probe.invalid";
const password = "BriefProbe-2026!x";

async function main() {
  await db.user.deleteMany({ where: { email } });
  const user = await db.user.create({
    data: {
      email,
      name: "Brief Probe",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.log("probe admin created:", user.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
