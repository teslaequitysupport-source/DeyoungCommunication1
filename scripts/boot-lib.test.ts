// Unit check for the DATABASE_URL auto-repair in scripts/boot-lib.ts
// (pure functions, no boot, no DB).
// Cases: the user's exact raw paste, the known-good encoded URL (idempotency),
// a raw '%' in a password, no password, no userinfo, non-postgres URL.
import { normalizeDatabaseUrl, withPoolParams } from "./boot-lib";

const RAW = "postgresql://postgres.ercecgqzogmmhhueyygu:#T2$WF2,VwRp)&J@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require";
const ENCODED = "postgresql://postgres.ercecgqzogmmhhueyygu:%23T2%24WF2%2CVwRp%29%26J@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require";

let failures = 0;
function check(name: string, got: { url: string; changed: boolean }, wantUrl: string, wantChanged: boolean) {
  const urlOk = got.url === wantUrl;
  const changedOk = got.changed === wantChanged;
  if (!urlOk || !changedOk) {
    failures++;
    console.log(`FAIL ${name}\n  got url=${got.url}\n  want url=${wantUrl}\n  got changed=${got.changed} want=${wantChanged}`);
  } else {
    console.log(`PASS ${name} (changed=${got.changed})`);
  }
}

check("raw paste is repaired", normalizeDatabaseUrl(RAW), ENCODED, true);
check("encoded URL is idempotent", normalizeDatabaseUrl(ENCODED), ENCODED, false);
check("raw percent in password is encoded", normalizeDatabaseUrl("postgresql://u:pa%zz@h:5432/db"), "postgresql://u:pa%25zz@h:5432/db", true);
check("no password untouched", normalizeDatabaseUrl("postgresql://u@h:5432/db"), "postgresql://u@h:5432/db", false);
check("no userinfo untouched", normalizeDatabaseUrl("postgresql://h:5432/db"), "postgresql://h:5432/db", false);
check("non-postgres untouched", normalizeDatabaseUrl("mysql://u:p#x@h/db"), "mysql://u:p#x@h/db", false);

// The repaired URL must parse and round-trip the password exactly.
const parsed = new URL(ENCODED);
const roundTrip = decodeURIComponent(parsed.password) === "#T2$WF2,VwRp)&J";
console.log(roundTrip ? "PASS repaired URL parses; decodeURIComponent round-trips the password" : "FAIL round-trip");
if (!roundTrip) failures++;

// withPoolParams: appends missing pool params, respects existing ones,
// never touches non-postgres URLs, and is idempotent.
let pf = 0;
function pcheck(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!cond) pf++;
}
{
  const { url, added } = withPoolParams(ENCODED);
  pcheck("pool: appends defaults", url.includes("connection_limit=10") && url.includes("pool_timeout=15") && url.includes("connect_timeout=10") && url.includes("sslmode=require"), `added=${added.join(",")}`);
  const again = withPoolParams(url);
  pcheck("pool: idempotent", again.added.length === 0 && again.url === url);
  const respect = withPoolParams("postgresql://u:p@h:5432/db?connection_limit=3");
  pcheck("pool: respects existing connection_limit", !respect.url.includes("connection_limit=10") && respect.url.includes("connection_limit=3"));
  const noQuery = withPoolParams("postgresql://u:p@h:5432/db");
  pcheck("pool: no-query URL gets ?params", noQuery.url.includes("?connection_limit=10"));
  const mysql = withPoolParams("mysql://u:p@h/db");
  pcheck("pool: non-postgres untouched", mysql.url === "mysql://u:p@h/db" && mysql.added.length === 0);
}
failures += pf;

process.exit(failures === 0 ? 0 : 1);
