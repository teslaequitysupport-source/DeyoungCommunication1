// Standalone audio gateway entry. Kept for local development and the admin
// Services card: runs on its own port with a /health endpoint. Production
// single-port deployments (Railway etc.) use server.ts, which attaches
// attachGateway() to the Next.js HTTP server instead.
//
// Both modes use the same socket.io path "/gateway" - one contract for
// browsers, the Python agent, and the transport probe. A reverse proxy in
// front of this port must path-route /gateway here (no query tricks).

import { createServer } from "http";
import { attachGateway, gatewayPairCount } from "./attach";

const PORT = Number(process.env.VOXCORE_GATEWAY_PORT || 3003);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, sessions: gatewayPairCount(), time: new Date().toISOString() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

attachGateway(httpServer);

httpServer.listen(PORT, () => {
  console.log(JSON.stringify({ level: "info", msg: "audio_gateway_listening", port: PORT, mode: "standalone", path: "/gateway" }));
});
