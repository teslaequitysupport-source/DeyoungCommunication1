// Startup environment doctor. Runs BEFORE prisma db push in the Railway
// start command so a misconfigured deployment fails with an exact,
// human-readable message instead of a cryptic Prisma parse error.
// Fail = exit 1 (honest fail-fast, container stays down until fixed).
// Warn = printed but boot continues.

const RAW_SPECIALS = "#$,&()";

function fail(messages: string[]): never {
  for (const m of messages) console.error(`ENV-DOCTOR FAIL: ${m}`);
  console.error(
    "ENV-DOCTOR: fix the variables above in the Railway dashboard (Service -> Variables), then redeploy."
  );
  process.exit(1);
}

function main() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    fail([
      "DATABASE_URL is not set. This platform requires PostgreSQL since 2026-09-12.",
      "Example (Supabase session-mode pooler):",
      "  postgresql://postgres.<ref>:<URL-ENCODED-PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
    ]);
  }

  if (url.startsWith("file:")) {
    fail([
      "DATABASE_URL is a SQLite file: URL, but the schema provider is postgresql since 2026-09-12.",
      "Set the Supabase pooler URL instead (see .env.example / docs/38-DEPLOYMENT.md).",
    ]);
  }

  if (!/^postgres(ql)?:\/\//.test(url)) {
    fail([`DATABASE_URL does not look like a PostgreSQL URL (got scheme "${url.split(":")[0]}...").`]);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    fail([
      "DATABASE_URL cannot be parsed as a URL.",
      "Most common cause: the database password contains raw special characters.",
      "URL-encode the password: # -> %23, $ -> %24, , -> %2C, ) -> %29, & -> %26.",
    ]);
  }

  if (parsed.hash && parsed.hash !== "") {
    fail([
      "DATABASE_URL contains a raw '#' - everything from it was cut off as a URL fragment, so the host/password are wrong.",
      "The '#' in your password must be URL-encoded as %23.",
      "Example of a correctly encoded Supabase URL:",
      "  postgresql://postgres.<ref>:%23T2%24WF2%2CVwRp%29%26J@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
    ]);
  }

  if (!parsed.hostname || !parsed.port) {
    fail([
      `DATABASE_URL host/port could not be read (host="${parsed.hostname}", port="${parsed.port}").`,
      "For Supabase use the pooler host, e.g. aws-1-eu-west-1.pooler.supabase.com:5432.",
    ]);
  }

  if (!parsed.password) {
    fail([
      "DATABASE_URL has no password. The password must be URL-encoded in the URL",
      "(raw # $ , ) & characters in the password break parsing).",
    ]);
  }

  try {
    decodeURIComponent(parsed.password);
  } catch {
    fail(["DATABASE_URL password has malformed percent-encoding. Re-encode it and redeploy."]);
  }

  // Non-fatal configuration notes.
  const host = parsed.hostname;
  const isSupabasePooler = host.includes("pooler.supabase.com");
  if (isSupabasePooler && parsed.port === "6543") {
    console.log(
      "ENV-DOCTOR WARN: port 6543 is Supabase's TRANSACTION-mode pooler; Prisma needs ?pgbouncer=true in that mode. Port 5432 (session mode) is recommended."
    );
  }
  if (isSupabasePooler && !url.includes("sslmode=")) {
    console.log("ENV-DOCTOR WARN: no sslmode in DATABASE_URL; Supabase requires TLS - append ?sslmode=require.");
  }
  if (!process.env.APP_ORIGIN) {
    console.log(
      "ENV-DOCTOR WARN: APP_ORIGIN not set - Kaggle worker cells and (future) email links would point at http://localhost:3000. Set it to https://<your-service>.up.railway.app."
    );
  }
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.log(
      "ENV-DOCTOR WARN: ADMIN_EMAIL/ADMIN_PASSWORD not set - the platform will boot but there will be NO admin account (there are no default credentials by design). Set both and redeploy on an empty database."
    );
  }
  if (!process.env.GATEWAY_SECRET || !process.env.NEXTAUTH_SECRET) {
    console.log(
      "ENV-DOCTOR WARN: GATEWAY_SECRET/NEXTAUTH_SECRET not set - the app boots with dev fallback secrets. Set them before real use."
    );
  }

  console.log(
    `ENV-DOCTOR OK: db=${host}:${parsed.port}${parsed.pathname} admin=${process.env.ADMIN_EMAIL ? "yes" : "no"} secrets=${process.env.GATEWAY_SECRET && process.env.NEXTAUTH_SECRET ? "yes" : "no"}`
  );
}

main();
