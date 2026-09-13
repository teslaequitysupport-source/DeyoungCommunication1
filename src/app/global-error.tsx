"use client";

// Global error boundary: catches faults in the ROOT layout itself (things the
// segment boundary above cannot see). Must render its own <html>/<body>; it
// does not inherit the app shell. Self-contained inline styles so it works
// even when the global stylesheet failed to load.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#050505", color: "#fafafa", fontFamily: "ui-sans-serif, system-ui, sans-serif", margin: 0 }}>
        <div style={{ alignItems: "center", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", padding: "24px", textAlign: "center" }}>
          <p style={{ color: "#e8192c", fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.35em", textTransform: "uppercase" }}>
            VoxCore / Critical Fault
          </p>
          <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 700, letterSpacing: "-0.02em", margin: "24px 0 0" }}>
            Something broke on our side.
          </h1>
          <p style={{ color: "#a3a3a8", fontSize: 14, lineHeight: 1.7, margin: "20px auto 0", maxWidth: 420 }}>
            A critical fault occurred outside the normal application boundary.
            The failure is logged server-side. Retry below - if it persists,
            quote the digest.
          </p>
          {error?.digest ? (
            <p style={{ border: "1px solid rgba(255,255,255,0.1)", fontFamily: "ui-monospace, monospace", fontSize: 12, margin: "16px 0 0", padding: "8px 16px" }}>
              digest: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              background: "#e8192c",
              border: "1px solid #e8192c",
              color: "#ffffff",
              cursor: "pointer",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.2em",
              marginTop: 32,
              padding: "12px 32px",
              textTransform: "uppercase",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
