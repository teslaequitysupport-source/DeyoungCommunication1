// Deployment seed guard: runs the full seed ONLY on an empty database.
// scripts/seed.ts is mostly upserts but still uses raw creates for models,
// budget policy and settings, so running it twice would crash (or duplicate).
// A fresh Railway/VM deploy runs this once; later restarts skip it.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.count();
  if (users > 0) {
    console.log(`seed-if-empty: ${users} user(s) exist, skipping seed`);
    return;
  }
  console.log("seed-if-empty: empty database, running full seed");
  const { spawnSync } = await import("child_process");
  const res = spawnSync("bun", ["scripts/seed.ts"], { stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`seed failed with exit code ${res.status}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
