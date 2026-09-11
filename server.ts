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

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);

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
      console.error("request handling error", err);
      res.statusCode = 500;
      res.end("internal server error");
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

  server.listen(port, () => {
    console.log(JSON.stringify({ level: "info", msg: "voxcore_listening", port, dev, gateway: "/gateway" }));
  });
}

main().catch((err) => {
  console.error("fatal: unified server failed to start", err);
  process.exit(1);
});
