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
};

export default nextConfig;
