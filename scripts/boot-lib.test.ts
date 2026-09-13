// Unit check for the DATABASE_URL auto-repair in scripts/boot-lib.ts
// (pure functions, no boot, no DB).
// Cases: the user's exact raw paste, the known-good encoded URL (idempotency),
// a raw '%' in a password, no password, no userinfo, non-postgres URL.
import { normalizeDatabaseUrl } from "./boot-lib";

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

process.exit(failures === 0 ? 0 : 1);
