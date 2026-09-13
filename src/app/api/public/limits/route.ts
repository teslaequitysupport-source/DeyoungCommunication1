import { wrap, jsonOk } from "@/lib/http";
import { RATE_RULES } from "@/lib/rate-limit";

// Public disclosure of the rate limits this deployment actually enforces.
// The values are read from the same RATE_RULES table the server enforces on
// every request - nothing here is decorative or hardcoded for show.

const PUBLIC_RULE_KEYS = [
  "authLogin",
  "authRegister",
  "authPasswordReset",
  "emailResend",
  "sessionStart",
  "modelUpload",
  "modelReport",
  "supportCreate",
  "apiRead",
  "apiWrite",
] as const;

export const GET = wrap(
  async () => {
    const rules = PUBLIC_RULE_KEYS.map((key) => {
      const r = RATE_RULES[key];
      return {
        key,
        bucket: r.name,
        limit: r.limit,
        windowSec: r.windowSec,
      };
    });
    return jsonOk({
      enforcement: "fixed-window counters persisted in the database, checked server-side on every request",
      abuse: "exceeded limits return HTTP 429 with a Retry-After header and are written to the security event log",
      rules,
    });
  },
  { rule: "apiRead", skipMetrics: true }
);
