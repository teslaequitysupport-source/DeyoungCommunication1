import AppShell from "@/components/app/app-shell";

// The entire application is delivered on this route as an SPA. In the
// production multi-route deployment the same views are split into real
// routes (documented in docs/39-DEVELOPMENT.md); the sandbox preview
// exposes only this page, so navigation is hash-based here.

export default function Home() {
  return <AppShell />;
}
