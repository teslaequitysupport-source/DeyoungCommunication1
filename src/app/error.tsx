"use client";

// Route-segment error boundary. A render failure no longer shows Next's
// generic crash page - it gets the REDLINE frame, an honest one-line
// explanation, the error digest for support, and a working retry.
// The full server-side diagnosis lives in /api/health (public) and the
// operator brief (admin-only).

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side render errors surface in the console; the digest lets
    // support correlate this screen with the server-side log entry.
    console.error("voxcore_ui_error", error.message, error.digest);

    // Self-report the fault so the operator brief shows it without the
    // visitor having to copy anything. Best-effort: never throws, never
    // retries (one report per fault per page load).
    try {
      const buildSha =
        document.querySelector('meta[name="voxcore-build"]')?.getAttribute("content") ?? undefined;
      void fetch("/api/client-errors", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          message: error.message.slice(0, 600) || "route boundary fault",
          stack: error.stack ? error.stack.slice(0, 4000) : undefined,
          digest: error.digest ? error.digest.slice(0, 100) : undefined,
          route: window.location.hash.replace(/^#\/?/, "").slice(0, 200) || undefined,
          page: window.location.pathname.slice(0, 200),
          buildSha: buildSha ? buildSha.slice(0, 50) : undefined,
        }),
      }).catch(() => {});
    } catch {
      // never let reporting throw
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-6 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden />
      <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#e8192c]">VoxCore / Fault</p>
      <h1 className="mt-6 font-[family-name:var(--font-grotesk)] text-4xl font-bold tracking-tight text-[#fafafa] md:text-6xl">
        Something broke on our side.
      </h1>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-[#a3a3a8]">
        This was a server or render fault, not anything you did. The fault has
        been reported automatically with full technical detail. Retry first -
        if it persists, quote the digest below.
      </p>
      {error?.digest ? (
        <p className="mt-4 border border-white/10 bg-white/[0.03] px-4 py-2 font-mono text-xs text-[#a3a3a8]">
          digest: <span className="text-[#fafafa]">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={reset}
          className="border border-[#e8192c] bg-[#e8192c] px-8 py-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-[#ff2e3f]"
        >
          Retry
        </button>
        <button
          onClick={() => window.location.reload()}
          className="border border-white/20 px-8 py-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#fafafa] transition-colors hover:border-white/50"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
