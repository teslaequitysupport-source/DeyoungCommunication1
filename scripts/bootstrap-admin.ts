// Idempotent bootstrap admin: runs on EVERY boot, not just an empty database.
//
// Why: seed-if-empty only creates the admin when the users table is empty, so
// a single early registration permanently locked the operator out of the
// admin command centre. This step guarantees: after any boot with
// ADMIN_EMAIL + ADMIN_PASSWORD set, exactly one ADMIN account exists with
// those credentials - regardless of table state.
//
// Behavior (honest, deterministic):
//   - env not set  -> loud note, exit 0 (never blocks serving)
//   - user absent  -> created as ADMIN / ACTIVE / email-verified
//   - user present -> promoted to ADMIN, re-activated, password reset to the
//     env value on every boot. The env is the source of truth for the
//     bootstrap account; rotate by changing the variable and restarting.
//     (Documented in the operator brief note "Create the real admin account".)
//   - any DB error -> logged loudly, exit 0 (boot continues; the server must
//     come up even if this step fails)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeDatabaseUrl } from "./boot-lib";

const repaired = normalizeDatabaseUrl(process.env.DATABASE_URL ?? "").url;
process.env.DATABASE_URL = repaired;

const db = new PrismaClient({ log: ["error"] });

function log(msg: string) {
  console.log(JSON.stringify({ level: "info", msg, ts: new Date().toISOString() }));
}

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    log("BOOT: bootstrap admin skipped - ADMIN_EMAIL/ADMIN_PASSWORD not set (the admin command centre will be unreachable). Set both in the Railway dashboard and restart.");
    return;
  }
  if (password.length < 10) {
    log("BOOT: bootstrap admin skipped - ADMIN_PASSWORD is shorter than 10 characters (platform minimum). Set a stronger password.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await db.user.findUnique({ where: { email } });

  if (!existing) {
    await db.user.create({
      data: {
        email,
        passwordHash,
        name: "Operator",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    log(`BOOT: bootstrap admin created: ${email} (ADMIN/ACTIVE, credentials = ADMIN_EMAIL/ADMIN_PASSWORD env)`);
    return;
  }

  const needsPromote = existing.role !== "ADMIN";
  const needsActive = existing.status !== "ACTIVE";
  const needsVerify = existing.emailVerifiedAt === null;
  const passwordMatches = await bcrypt.compare(password, existing.passwordHash).catch(() => false);

  if (!needsPromote && !needsActive && !needsVerify && passwordMatches) {
    log(`BOOT: bootstrap admin verified: ${email}`);
    return;
  }

  await db.user.update({
    where: { id: existing.id },
    data: {
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      passwordHash: passwordMatches ? existing.passwordHash : passwordHash,
    },
  });
  log(
    `BOOT: bootstrap admin ensured: ${email}` +
      (needsPromote ? " [promoted to ADMIN]" : "") +
      (needsActive ? " [re-activated]" : "") +
      (needsVerify ? " [email verified]" : "") +
      (!passwordMatches ? " [password synced to ADMIN_PASSWORD env]" : "")
  );
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ level: "error", msg: `BOOT: bootstrap admin failed (non-fatal): ${String(e)?.slice(0, 300)}`, ts: new Date().toISOString() }));
    process.exit(0); // never block serving on this step
  })
  .finally(() => db.$disconnect());
