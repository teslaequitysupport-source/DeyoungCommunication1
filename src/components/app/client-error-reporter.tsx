"use client";

// ClientErrorReporter: global window listeners that self-report uncaught UI
// faults to /api/client-errors. The route error boundary catches render
// faults; these listeners catch everything else (event-handler throws,
// unhandled promise rejections, chunk-load failures) that would otherwise
// vanish into the browser console, invisible to the operator.
//
// Discipline:
// - Deduplicates by message so one looping fault sends ONE report.
// - Hard cap of 5 reports per page load, whatever happens.
// - Never throws and never retries: reporting must not create new faults.
// - Reads the deployed build from the voxcore-build meta tag so every report
//   names the exact build that faulted.

import { useEffect } from "react";

const MAX_REPORTS_PER_LOAD = 5;

export default function ClientErrorReporter() {
  useEffect(() => {
    const sent = new Set<string>();
    let sendCount = 0;

    const report = (message: string, stack: string | null, digest?: string) => {
      if (sendCount >= MAX_REPORTS_PER_LOAD) return;
      const key = `${digest ?? ""}|${message}`;
      if (sent.has(key)) return;
      sent.add(key);
      sendCount += 1;

      const buildSha =
        document.querySelector('meta[name="voxcore-build"]')?.getAttribute("content") ?? undefined;

      try {
        void fetch("/api/client-errors", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            message: message.slice(0, 600),
            stack: stack ? stack.slice(0, 4000) : undefined,
            digest: digest ? digest.slice(0, 100) : undefined,
            route: window.location.hash.replace(/^#\/?/, "").slice(0, 200) || undefined,
            page: window.location.pathname.slice(0, 200),
            buildSha: buildSha ? buildSha.slice(0, 50) : undefined,
          }),
        }).catch(() => {});
      } catch {
        // never let reporting throw
      }
    };

    const onError = (e: ErrorEvent) => {
      // Resource-load errors (img/script) bubble as ErrorEvent with no stack;
      // they are noise for this purpose unless they carry a real message.
      if (!e.message) return;
      report(e.message, e.error?.stack ?? null);
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      const message = r instanceof Error ? r.message : String(r ?? "unhandled rejection");
      report(message, r instanceof Error ? (r.stack ?? null) : null);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
