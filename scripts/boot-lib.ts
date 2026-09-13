// Pure helpers for scripts/boot.ts - NO side effects, safe to import from
// tests. See boot.ts for the boot orchestration itself.

// Percent-encode the userinfo (username + password) segment of a PostgreSQL
// URL. Safe characters (RFC 3986 unreserved) and existing % sequences are
// left untouched, so an already-encoded URL passes through byte-identical
// (idempotent) and a raw password gets exactly the encoding Prisma needs.
export function normalizeDatabaseUrl(raw: string): { url: string; changed: boolean } {
  if (!/^postgres(?:ql)?:\/\//.test(raw)) return { url: raw, changed: false };
  const schemeEnd = raw.indexOf("://") + 3;
  const at = raw.lastIndexOf("@");
  if (at < schemeEnd) return { url: raw, changed: false }; // no userinfo
  const userinfo = raw.slice(schemeEnd, at);
  const colon = userinfo.indexOf(":");
  if (colon < 0) return { url: raw, changed: false }; // no password
  const encodeSegment = (seg: string) => {
    let s = seg;
    // If the segment has MALFORMED percent-encoding (e.g. a literal raw '%'),
    // treat every '%' as a literal character first (%25) so the result is
    // parseable. Valid pre-encoded URLs decode cleanly and pass untouched.
    try {
      decodeURIComponent(s);
    } catch {
      s = s.replace(/%/g, "%25");
    }
    return s.replace(/[^A-Za-z0-9\-._~%]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
  };
  const fixed = `${encodeSegment(userinfo.slice(0, colon))}:${encodeSegment(userinfo.slice(colon + 1))}`;
  if (fixed === userinfo) return { url: raw, changed: false };
  return { url: raw.slice(0, schemeEnd) + fixed + raw.slice(at), changed: true };
}

// Log-safe preview: hide the password, keep everything else readable.
export function mask(url: string): string {
  return url.replace(/(\/\/[^:/@]+:)[^@]*(@)/, "$1***$2");
}

// Append Prisma connection-pool parameters when the caller has not set them.
// Rationale: on small Railway containers the default pool size scales with CPU
// count, and a burst of concurrent requests can exhaust the database's pooler
// connections, surfacing as intermittent 500s on every DB-backed route. An
// explicit, modest pool with a timeout converts that failure class into a
// short wait, and an existing ?connection_limit= is always respected.
export function withPoolParams(
  raw: string,
  params: Record<string, string> = { connection_limit: "10", pool_timeout: "15", connect_timeout: "10" }
): { url: string; added: string[] } {
  if (!/^postgres(?:ql)?:\/\//.test(raw)) return { url: raw, added: [] };
  const [base, query = ""] = raw.split("?");
  const existing = new Set(query.split("&").map((kv) => kv.split("=")[0]).filter(Boolean));
  const added: string[] = [];
  const pairs: string[] = query ? [query] : [];
  for (const [k, v] of Object.entries(params)) {
    if (!existing.has(k)) {
      pairs.push(`${k}=${v}`);
      added.push(k);
    }
  }
  return { url: pairs.length ? `${base}?${pairs.join("&")}` : base, added };
}
