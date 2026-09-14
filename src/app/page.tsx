import AppShell from "@/components/app/app-shell";

// The entire application is delivered on this route as an SPA. In the
// production multi-route deployment the same views are split into real
// routes (documented in docs/39-DEVELOPMENT.md); the sandbox preview
// exposes only this page, so navigation is hash-based here.

export default function Home() {
  // Baked at build time. Railway injects RAILWAY_GIT_COMMIT_SHA into the
  // build environment, so the footer chip names the commit this build was
  // made from. Same fallback chain as /api/health.
  const buildSha =
    process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "dev-local";
  return <AppShell buildSha={buildSha} />;
}
