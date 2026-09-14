// VOXCORE unified server: control plane (Next.js) and audio gateway on ONE
// HTTP port. This is the production entry for single-port platforms like
// Railway: the platform routes public traffic to $PORT, the gateway rides
// the same server at the socket.io path "/gateway", and Python workers dial
// it over outbound connections (ws(s)://<host>/gateway).
//
// Sets VOXCORE_GATEWAY_INPROCESS=1 so the scheduler and the test lab know
// the gateway lives in this process and generate URLs for this mode.
//
// Run: bun server.ts   (dev or production; NODE_ENV decides next({ dev }))

import { createServer } from "http";
import next from "next";

// Must be set before any control-plane module reads it.
process.env.VOXCORE_GATEWAY_INPROCESS = "1";

// Availability guard: a background error (gateway metrics post, socket.io
// callback, database blip in an async path) must never take the listener
// down - that is what a 502 is. Log loudly and keep serving; boot failures
// below are still fatal via main().catch.
process.on("unhandledRejection", (reason) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "unhandled_rejection_contained",
      err: reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
      ts: new Date().toISOString(),
    })
  );
});
process.on("uncaughtException", (err) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "uncaught_exception_contained",
      err: err instanceof Error ? (err.stack ?? err.message) : String(err),
      ts: new Date().toISOString(),
    })
  );
});

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);

// Last-resort 500 page for requests that crash Next's own handler (render
// faults, RSC payload failures). Dependency-free inline HTML: no DB, no
// fonts, no stylesheet. This replaces the old bare-text "internal server
// error" response, which was the one failure surface with no branding, no
// guidance and no diagnosis path.
const FALLBACK_500_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>VoxCore / Fault</title>
</head>
<body style="background:#0a0a0d;color:#f4f4f0;font-family:ui-sans-serif,system-ui,sans-serif;margin:0">
<div style="align-items:center;display:flex;flex-direction:column;justify-content:center;min-height:100vh;padding:24px;text-align:center">
<p style="color:#e11d2e;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.35em;text-transform:uppercase">VoxCore / Fault</p>
<h1 style="font-size:clamp(32px,6vw,56px);font-weight:700;letter-spacing:-0.02em;margin:24px 0 0">Something broke on our side.</h1>
<p style="color:#a3a3a8;font-size:14px;line-height:1.7;margin:20px auto 0;max-width:420px">This request hit a fault outside the normal error handling. It is logged with full detail in the server logs. Reload first. If it persists, the public diagnostics endpoint below reports the deployed build and the last recorded error.</p>
<div style="display:flex;gap:16px;margin-top:32px;flex-wrap:wrap;justify-content:center">
<a href="/" style="background:#e11d2e;border:1px solid #e11d2e;color:#ffffff;font-family:ui-monospace,monospace;font-size:12px;font-weight:600;letter-spacing:0.2em;padding:12px 32px;text-decoration:none;text-transform:uppercase">Reload</a>
<a href="/api/health" style="border:1px solid rgba(255,255,255,0.2);color:#f4f4f0;font-family:ui-monospace,monospace;font-size:12px;font-weight:600;letter-spacing:0.2em;padding:12px 32px;text-decoration:none;text-transform:uppercase">Diagnostics</a>
</div>
</div>
</body>
</html>`;

// The gateway reports session metrics to the control plane over HTTP; inside
// this process that is the same server, so default BACKEND_URL to itself.
if (!process.env.BACKEND_URL) {
  process.env.BACKEND_URL = `http://127.0.0.1:${port}`;
}

async function main() {
  // Import after env setup so every module sees the final environment.
  const { attachGateway } = await import("./mini-services/audio-gateway/attach");

  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      // Structured log line: this is the one 500 class invisible to
      // RequestMetric (the metric write lives inside route handlers, which
      // have already crashed here), so the platform log is its only record.
      console.error(
        JSON.stringify({
          level: "error",
          msg: "request_handling_error",
          route: req.url,
          method: req.method,
          err: err instanceof Error ? (err.stack ?? err.message) : String(err),
          ts: new Date().toISOString(),
        })
      );
      res.statusCode = 500;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.end(FALLBACK_500_HTML);
    });
  });

  attachGateway(server, { path: "/gateway" });

  // In dev, Next's HMR websocket upgrades must reach Next's own upgrade
  // handler. engine.io (attached above) only consumes upgrades whose path
  // matches /gateway; everything else falls through to this listener.
  // In production there are no HMR upgrades; engine.io owns /gateway.
  if (dev) {
    const upgradeHandler = (app as unknown as { getUpgradeHandler?: () => (req: unknown, sock: unknown, head: unknown) => void }).getUpgradeHandler?.();
    if (upgradeHandler) {
      server.on("upgrade", (req, socket, head) => upgradeHandler(req, socket, head));
    }
  }

  // Bind 0.0.0.0 explicitly: single-port platforms (Railway) route to the
  // container's IPv4 interface; never bind to a loopback host here.
  server.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ level: "info", msg: "voxcore_listening", port, host: "0.0.0.0", dev, gateway: "/gateway" }));
  });

  // Graceful platform shutdown (SIGTERM on redeploy/scale): stop accepting
  // new connections, finish in-flight ones, exit cleanly instead of a hard
  // kill that can orphan requests.
  const shutdown = (signal: string) => {
    console.log(JSON.stringify({ level: "info", msg: "voxcore_shutdown", signal }));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("fatal: unified server failed to start", err);
  process.exit(1);
});
