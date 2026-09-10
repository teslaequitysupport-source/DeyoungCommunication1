import { wrap, jsonOk } from "@/lib/http";
import { getSiteConfig } from "@/lib/settings";

// Public runtime configuration for the SPA shell (name, announcements, mode
// switches). No secrets, no private data.

export const GET = wrap(
  async () => {
    const config = await getSiteConfig();
    return jsonOk({ config });
  },
  { rule: "apiRead", skipMetrics: true }
);
