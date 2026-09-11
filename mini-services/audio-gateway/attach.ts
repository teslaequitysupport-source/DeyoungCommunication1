// VOXCORE AUDIO GATEWAY - attachable module
//
// Pairs browser clients with GPU/worker agents for real-time audio streaming.
// Both sides authenticate with a short-lived signed token issued by the
// control-plane scheduler (HS256, verified locally: the gateway has no
// database and cannot leak session state).
//
// attachGateway(httpServer, opts) mounts the socket.io gateway on ANY http
// server. Two deployments:
// - Unified (recommended for Railway/any single-port PaaS): server.ts attaches
//   it to the Next.js HTTP server at path "/gateway" on $PORT.
// - Standalone: index.ts keeps its own http server on VOXCORE_GATEWAY_PORT.
//
// Roles per session: exactly one "client" socket and one "worker" socket.
// Audio frames flow: client -> gateway -> worker (raw PCM16), worker -> gateway
// -> client (converted PCM16). The gateway measures per-chunk round trips and
// forwards summary metrics to the control plane on session end.
//
// Outbound-only from the worker's perspective: the worker dials the gateway;
// no inbound ports are needed on Kaggle or any sandboxed provider.

import { Server, Socket } from "socket.io";
import crypto from "crypto";

const SECRET = process.env.GATEWAY_SECRET || process.env.NEXTAUTH_SECRET || "dev-only-gateway-secret-change-me";
const CONTROL_PLANE = process.env.BACKEND_URL || "http://127.0.0.1:3000";

export interface Claims {
  sid: string;
  uid: string;
  wid: string;
  mid: string;
  role: "client" | "worker";
  exp: number;
}

function verifyToken(token: string): Claims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as Claims;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

interface Pair {
  sid: string;
  client?: Socket;
  worker?: Socket;
  chunksIn: number;
  chunksOut: number;
  latencies: number[];
  pending: Map<string, number>; // seq -> client send time
  seq: number;
  lastActivity: number;
  metricsReported: boolean;
}

const pairs = new Map<string, Pair>();

// Periodic cleanup of dead pairs.
setInterval(() => {
  const now = Date.now();
  for (const [sid, p] of pairs) {
    if (now - p.lastActivity > 120_000) {
      pairs.delete(sid);
      void reportMetrics(sid, p, "TIMEOUT").catch(() => {});
    }
  }
}, 30_000).unref?.();

async function reportMetrics(sid: string, p: Pair, endReason: string) {
  const lat = p.latencies.slice(0, 2000);
  if (lat.length === 0) return;
  const sorted = [...lat].sort((a, b) => a - b);
  const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  const payload = {
    sessionId: sid,
    endReason,
    p50Ms: pct(0.5),
    p95Ms: pct(0.95),
    packetsSent: p.chunksIn,
    packetsReceived: p.chunksOut,
    dropsPct: p.chunksIn > 0 ? Math.max(0, Math.round(((p.chunksIn - p.chunksOut) / p.chunksIn) * 1000) / 10) : 0,
  };
  try {
    await fetch(`${CONTROL_PLANE}/api/internal/session-metrics`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gateway-secret": SECRET },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "metrics_report_failed", sid, err: String(e) }));
  }
}

export function gatewayPairCount(): number {
  return pairs.size;
}

export function attachGateway(httpServer: import("http").Server, opts?: { path?: string }) {
  // Default "/gateway": a dedicated URL path so the gateway can share one
  // HTTP port with the Next.js control plane (PaaS deployments route exactly
  // one public port). The standalone index.ts keeps its legacy "/" hijack.
  const path = opts?.path ?? "/gateway";

  const io = new Server(httpServer, {
    path,
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 30_000,
    pingInterval: 15_000,
    maxHttpBufferSize: 2e6,
  });

  io.on("connection", (socket: Socket) => {
    let claims: Claims | null = null;
    let joined = false;

    console.log(JSON.stringify({ level: "info", msg: "socket_connected", id: socket.id }));
    socket.on("disconnect", (reason) => {
      console.log(JSON.stringify({ level: "info", msg: "socket_disconnected", id: socket.id, authed: !!claims, role: claims?.role, sid: claims?.sid, reason }));
    });

    socket.on("auth", ({ token }: { token?: string }, ack?: (r: { ok: boolean; error?: string; role?: string; sid?: string; peerConnected?: boolean }) => void) => {
      if (typeof token !== "string" || token.length === 0) {
        ack?.({ ok: false, error: "Missing session token" });
        socket.disconnect(true);
        return;
      }
      claims = verifyToken(token);
      if (!claims) {
        ack?.({ ok: false, error: "Invalid or expired session token" });
        socket.disconnect(true);
        return;
      }
      const existing = pairs.get(claims.sid);
      const pair: Pair = existing ?? { sid: claims.sid, client: undefined, worker: undefined, chunksIn: 0, chunksOut: 0, latencies: [], pending: new Map<string, number>(), seq: 0, lastActivity: Date.now(), metricsReported: false };
      pairs.set(claims.sid, pair);

      if (claims.role === "client") {
        if (pair.client && pair.client.id !== socket.id) {
          ack?.({ ok: false, error: "Session already has a client" });
          socket.disconnect(true);
          return;
        }
        pair.client = socket;
      } else {
        if (pair.worker && pair.worker.id !== socket.id) {
          ack?.({ ok: false, error: "Session already has a worker" });
          socket.disconnect(true);
          return;
        }
        pair.worker = socket;
      }
      joined = true;
      ack?.({ ok: true, role: claims.role, sid: claims.sid, peerConnected: !!(pair.client && pair.worker) });

      // Tell both sides when the pair is complete.
      if (pair.client && pair.worker) {
        pair.client.emit("peer-ready", { sid: claims.sid });
        pair.worker.emit("session-start", { sid: claims.sid, modelId: claims.mid });
      }
    });

    socket.on("audio", (data: Buffer | { seq: number; data: ArrayBuffer }, ack?: (r: { ok: boolean }) => void) => {
      if (!claims || !joined) {
        ack?.({ ok: false });
        return;
      }
      const pair = pairs.get(claims.sid);
      if (!pair) {
        ack?.({ ok: false });
        return;
      }
      pair.lastActivity = Date.now();

      if (claims.role === "client") {
        // Never silently swallow audio. If the worker has not joined the pair
        // yet, reject the chunk explicitly so the client knows frames were not
        // delivered (clients wait for peer-ready before streaming).
        if (!pair.worker) {
          ack?.({ ok: false });
          return;
        }
        const seq = ++pair.seq;
        pair.pending.set(String(seq), Date.now());
        pair.chunksIn++;
        if (pair.chunksIn % 10 === 0) {
          console.log(JSON.stringify({ level: "info", msg: "audio_c2w", sid: claims.sid, chunk: pair.chunksIn, pending: pair.pending.size }));
        }
        const payload = { seq, ts: Date.now(), audio: data instanceof Buffer ? new Uint8Array(data) : new Uint8Array((data as { data: ArrayBuffer }).data) };
        pair.worker.emit("audio-in", payload);
        ack?.({ ok: true });
      } else {
        // worker -> client: converted audio with the original seq for RTT math
        if (!pair.client) {
          ack?.({ ok: false });
          return;
        }
        const msg = data as unknown as { seq: number; audio: Uint8Array };
        const sentAt = pair.pending.get(String(msg.seq));
        if (sentAt !== undefined) {
          pair.latencies.push(Date.now() - sentAt);
          if (pair.latencies.length > 5000) pair.latencies.splice(0, pair.latencies.length - 5000);
          pair.pending.delete(String(msg.seq));
        }
        pair.chunksOut++;
        if (pair.chunksOut % 10 === 0) {
          console.log(JSON.stringify({ level: "info", msg: "audio_w2c", sid: claims.sid, chunk: pair.chunksOut }));
        }
        pair.client.emit("audio-out", { seq: msg.seq, ts: Date.now(), audio: msg.audio });
        ack?.({ ok: true });
      }
    });

    socket.on("end-session", async (ack?: (r: { ok: boolean }) => void) => {
      if (!claims) return;
      const pair = pairs.get(claims.sid);
      if (pair) {
        await reportMetrics(claims.sid, pair, "ENDED");
        pair.metricsReported = true;
        pair.client?.emit("session-ended", { sid: claims.sid });
        pair.worker?.emit("session-ended", { sid: claims.sid });
      }
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      if (!claims) return;
      const pair = pairs.get(claims.sid);
      if (!pair) return;
      if (claims.role === "client") pair.client = undefined;
      else pair.worker = undefined;
      if (!pair.client && !pair.worker && !pair.metricsReported) {
        void reportMetrics(claims.sid, pair, pair.chunksIn > 0 ? "ENDED" : "ABANDONED");
        pairs.delete(claims.sid);
      } else if (claims.role === "worker" && pair.client) {
        pair.client.emit("peer-lost", { reason: "WORKER_DISCONNECTED" });
      } else if (claims.role === "client" && pair.worker) {
        pair.worker.emit("session-ended", { sid: claims.sid });
      }
    });
  });

  return io;
}
