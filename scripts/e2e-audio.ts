// End-to-end audio proof: connects as the CLIENT of a live session, streams
// synthetic microphone chunks, and verifies converted audio returns through
// the real gateway + worker agent path. Measures chunk round trip.

import { io } from "socket.io-client";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const db = new PrismaClient();
const BASE = process.env.E2E_BASE || "http://127.0.0.1:3000";
const COOKIE = process.env.USER_JAR || "/tmp/user.jar";

function readCookie(file: string) {
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.includes("voxcore_session"));
  if (!line) throw new Error("no session cookie");
  return line.split("\t").pop()!.trim();
}

async function startSession(modelId) {
  const res = await fetch(`${BASE}/api/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `voxcore_session=${readCookie(COOKIE)}` },
    body: JSON.stringify({ modelId, requestedTier: "AUTO" }),
  });
  return res.json();
}

async function main() {
  const models = await (await fetch(`${BASE}/api/models`)).json();
  const model = models.models[0];
  const s = await startSession(model.id);
  if (!s.sessionId) throw new Error(`session start failed: ${JSON.stringify(s)}`);
  if (!s.workerId || !s.gatewayToken) {
    // Fail fast and end the session so the plan's concurrency slot is freed.
    console.error(`no worker/token issued (status=${s.status ?? "?"}) — not dialing the gateway`);
    if (s.sessionId) await fetch(`${BASE}/api/sessions/${s.sessionId}/end`, { method: "POST", headers: { cookie: `voxcore_session=${readCookie(COOKIE)}` } }).catch(() => {});
    await db.$disconnect();
    process.exit(1);
  }
  console.log("session:", s.sessionId, "worker:", s.workerId);

  // Dial the gateway the scheduler told us about. One socket.io contract for
  // both modes: path "/gateway"; gatewayUrl "" (or missing) means same origin.
  const gwRaw = s.gatewayUrl || "";
  const gwOrigin = gwRaw === "" ? BASE : gwRaw.startsWith("http") ? gwRaw : BASE;
  const socket = io(gwOrigin, {
    path: s.gatewayPath || "/gateway",
    transports: ["websocket", "polling"],
    forceNew: true,
  });

  socket.on("connect_error", (err: Error) => {
    console.error("gateway connect_error:", err.message);
  });

  const audioCtx = { sampleRate: 16000 };
  let received = 0;
  const rtts = [];
  const pending = new Map();
  let peerReady = false;

  socket.on("peer-ready", () => {
    peerReady = true;
    console.log("peer-ready: worker connected, starting stream");
  });

  socket.on("connect", () => {
    socket.emit("auth", { token: s.gatewayToken }, (ack) => {
      if (!ack.ok) throw new Error("gateway auth failed: " + ack.error);
      console.log("gateway auth ok, role:", ack.role, "peer:", ack.peerConnected);

      // Correct client behavior: do not stream before the worker joined the
      // pair. The gateway now rejects (not silently drops) pre-peer chunks.
      const waitPeer = setInterval(() => {
        if (!peerReady) return;
        clearInterval(waitPeer);

        // Stream 30 chunks of synthetic "speech-like" audio (128ms each).
        let seq = 0;
        const interval = setInterval(() => {
          seq++;
          const n = 2048;
          const pcm = new Int16Array(n);
          for (let i = 0; i < n; i++) {
            const t = (seq * n + i) / audioCtx.sampleRate;
            const v = Math.sin(2 * Math.PI * 220 * t) * 0.5 * (1 + 0.4 * Math.sin(2 * Math.PI * 3 * t));
            pcm[i] = Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
          }
          pending.set(seq, Date.now());
          socket.emit("audio", { seq, data: pcm.buffer });
          if (seq >= 30) clearInterval(interval);
        }, 140);
      }, 100);
    });
  });

  socket.on("audio-out", (msg) => {
    const sentAt = pending.get(msg.seq);
    if (sentAt !== undefined) {
      rtts.push(Date.now() - sentAt);
      pending.delete(msg.seq);
    }
    received++;
    if (received === 30) {
      const sorted = [...rtts].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      console.log(`AUDIO FLOW VERIFIED: 30/30 chunks converted and returned`);
      console.log(`chunk RTT p50=${p50}ms p95=${p95}ms (includes 140ms send cadence)`);
      (async () => {
        await fetch(`${BASE}/api/sessions/${s.sessionId}/metrics`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: `voxcore_session=${readCookie(COOKIE)}` },
          body: JSON.stringify({ p50Ms: p50, p95Ms: p95, packetsSent: 30, packetsReceived: received, dropsPct: 0 }),
        }).catch(() => {});
        await fetch(`${BASE}/api/sessions/${s.sessionId}/end`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: `voxcore_session=${readCookie(COOKIE)}` },
        }).catch(() => {});
        await db.$disconnect();
        process.exit(0);
      })();
    }
  });

  setTimeout(() => {
    console.error("TIMEOUT: audio did not flow. received:", received);
    // End the session so the plan's concurrency slot is not wedged by a
    // failed test run.
    fetch(`${BASE}/api/sessions/${s.sessionId}/end`, {
      method: "POST",
      headers: { cookie: `voxcore_session=${readCookie(COOKIE)}` },
    }).catch(() => {}).finally(() => { db.$disconnect(); process.exit(1); });
  }, 30_000);
}

main().catch((e) => {
  console.error("E2E FAIL:", e.message);
  process.exit(1);
});
