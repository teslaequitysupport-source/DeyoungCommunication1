// VOXCORE production boot orchestrator (Railway startCommand entry).
//
// Why this exists: a 502 on the platform means "container not listening".
// Every historical 502 was one of: (a) raw special characters in the
// DATABASE_URL password truncating the URL, (b) a transient database
// failure during boot with no retry, (c) a fatal step (seed) that does not
// affect serving, (d) restart policy giving up after 3 attempts. This script
// removes all four classes structurally instead of documenting them:
//
//   1. Auto-repair DATABASE_URL: raw special characters in the password
//      segment are percent-encoded (idempotent - already-encoded URLs are
//      returned unchanged). The corrected URL is inherited by db push,
//      seed AND the server process, so a pasted raw password simply works.
//   2. env-doctor still runs (fail-fast on unfixable configuration) but now
//      sees the repaired URL first.
//   3. prisma db push retries up to 3 times with backoff - a transient
//      Supabase/network blip no longer kills the container.
//   4. Seeding is best-effort: a seed failure is logged loudly but never
//      blocks serving (an empty catalog is a serving condition, not a crash).
//   5. The server runs in-process afterwards, so process.env corrections
//      apply to the Prisma client as well.
//
// Run: NODE_ENV=production bun scripts/boot.ts

import { spawnSync } from "child_process";
import { normalizeDatabaseUrl, withPoolParams, mask } from "./boot-lib";

function log(msg: string) {
  console.log(JSON.stringify({ level: "info", msg, ts: new Date().toISOString() }));
}

function logErr(msg: string) {
  console.error(JSON.stringify({ level: "error", msg, ts: new Date().toISOString() }));
}

// ---------------------------------------------------------------------------
// Step 1: auto-repair the DATABASE_URL password segment (see boot-lib.ts for
// the encoding rules). The corrected URL is inherited by db push, seed AND
// the in-process server, so a pasted raw password simply works.
// ---------------------------------------------------------------------------
function repairDatabaseUrl(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return true; // env-doctor reports this with exact instructions
  let { url, changed } = normalizeDatabaseUrl(raw);
  // Keep the runtime connection pool bounded and time-bounded (see
  // withPoolParams): unbounded pools on small containers exhaust the
  // database pooler under bursts and surface as intermittent 500s.
  const pooled = withPoolParams(url);
  if (pooled.added.length > 0) {
    url = pooled.url;
    changed = true;
    log(`BOOT: DATABASE_URL pool params added: ${pooled.added.join(", ")}`);
  }
  if (changed) {
    process.env.DATABASE_URL = url;
    logErr(
      "BOOT: DATABASE_URL contained raw characters in the credentials that break URL parsing " +
        "(typically a raw '#' which cuts the URL into a fragment). They were auto-encoded. " +
        `Repaired URL: ${mask(url)}. ` +
        "Set the encoded form in the Railway dashboard to silence this repair."
    );
  }
  return true;
}

// Child processes: Bun does NOT propagate JS-side process.env mutations to
// spawned children (they inherit the OS env from process start), so the
// repaired DATABASE_URL must be passed explicitly on every spawn.
function childEnv(): Record<string, string | undefined> {
  return { ...process.env, DATABASE_URL: process.env.DATABASE_URL };
}

// ---------------------------------------------------------------------------
// Step 2: env-doctor (fail-fast with exact human-readable fixes).
// ---------------------------------------------------------------------------
function runEnvDoctor(): void {
  const res = spawnSync("bun", ["scripts/env-doctor.ts"], { stdio: "inherit", env: childEnv() });
  if (res.status !== 0) {
    logErr(`BOOT FATAL: env-doctor exited ${res.status}; refusing to start with unfixable configuration.`);
    process.exit(res.status ?? 1);
  }
}

// ---------------------------------------------------------------------------
// Step 3: prisma db push with retry (transient network / pooler hiccups).
// ---------------------------------------------------------------------------
function runDbPush(): void {
  const attempts = 3;
  const backoffMs = [5_000, 15_000];
  for (let i = 1; i <= attempts; i++) {
    log(`BOOT: prisma db push attempt ${i}/${attempts}`);
    const res = spawnSync("bunx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit", env: childEnv() });
    if (res.status === 0) return;
    logErr(`BOOT: prisma db push failed (exit ${res.status})`);
    if (i < attempts) {
      const wait = backoffMs[i - 1];
      logErr(`BOOT: retrying in ${wait / 1000}s (transient database/network errors are expected occasionally)`);
      spawnSync("sleep", [String(wait / 1000)]);
    }
  }
  logErr(
    "BOOT FATAL: database schema could not be applied after 3 attempts. " +
      "The container will exit; the platform restart policy will keep retrying, " +
      "and this log line repeats until the database becomes reachable or DATABASE_URL is fixed."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 4: seed (best-effort - NEVER blocks serving).
// ---------------------------------------------------------------------------
function runSeed(): void {
  const res = spawnSync("bun", ["scripts/seed-if-empty.ts"], { stdio: "inherit", env: childEnv() });
  if (res.status !== 0) {
    logErr(
      "BOOT: SEED FAILED (non-fatal) - the platform will still serve, but the model " +
        "catalog may be empty and no admin may have been created. Full error above. " +
        "Fix the cause and redeploy on an empty database, or run scripts/seed.ts manually."
    );
  }
}

// ---------------------------------------------------------------------------
// Main. Step 5 (the server) runs in-process via import so the repaired env
// applies to the Prisma client too.
// ---------------------------------------------------------------------------
async function main() {
  log(`BOOT: starting (node_env=${process.env.NODE_ENV || "unset"}, pid=${process.pid})`);
  repairDatabaseUrl();
  runEnvDoctor();
  runDbPush();
  runSeed();
  log("BOOT: handoff to unified server (Next.js + audio gateway on $PORT)");
  await import("../server.ts");

  // Boot heartbeat: makes memory/OOM and restart patterns visible in logs.
  const started = Date.now();
  setInterval(() => {
    const mem = process.memoryUsage();
    log(
      `BOOT: alive uptime_s=${Math.round((Date.now() - started) / 1000)} rss_mb=${Math.round(mem.rss / 1048576)} heap_mb=${Math.round(mem.heapUsed / 1048576)}`
    );
  }, 5 * 60 * 1000).unref();
}

main().catch((err) => {
  logErr(`BOOT FATAL: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});
