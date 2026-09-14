import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No standalone output: production runs the unified server.ts entry
  // (Next.js request handling + audio gateway on one port), which uses the
  // regular .next build. See server.ts and docs/38-DEPLOYMENT.md.
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        // The app is a single-route SPA: the HTML document must always be
        // revalidated so every deploy is visible on the next load. A cached
        // document referencing old hashed chunks is exactly how a healthy
        // deployment looks "broken" to a returning visitor. Hashed static
        // assets under /_next/static keep their own long-lived caching, so
        // this costs nothing in practice.
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
