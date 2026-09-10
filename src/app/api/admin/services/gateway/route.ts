import { NextRequest } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { audit } from "@/lib/audit";

// CONTROL-PLANE MANAGED AUDIO GATEWAY
//
// The gateway is a separate service (mini-services/audio-gateway) on its own
// port. Instead of depending on an operator's shell session, the control
// plane can supervise it: POST starts it as a detached child, GET reports
// liveness, DELETE stops it. Children spawned by the server process persist
// across operator sessions, which is exactly how the local worker agent
// already runs.

const GATEWAY_DIR = path.join(process.cwd(), "mini-services", "audio-gateway");
const GATEWAY_ENTRY = path.join(GATEWAY_DIR, "index.ts");
const LOG_PATH = path.join(process.cwd(), ".zscripts", "gateway.log");
const PORT = Number(process.env.VOXCORE_GATEWAY_PORT || 3003);

let child: ChildProcess | null = null;

async function portListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1", timeout: 1200 });
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
}

async function probeHealth(): Promise<{ ok: boolean; sessions?: number }> {
  try {
    // The gateway mounts socket.io at path "/", which answers every URL on
    // the port; a plain /health GET is not reliable. The engine.io polling
    // handshake (response starts with "0{...sid...}") is the proven probe.
    const res = await fetch(`http://127.0.0.1:${PORT}/?EIO=4&transport=polling`, { signal: AbortSignal.timeout(1500) });
    const text = await res.text();
    return { ok: res.ok && text.startsWith("0") };
  } catch {
    return { ok: false };
  }
}

export const GET = wrap(
  async () => {
    await requireAdmin();
    const listening = await portListening(PORT);
    const health = listening ? await probeHealth() : { ok: false };
    return jsonOk({
      port: PORT,
      listening,
      managed: !!child,
      pid: child?.pid ?? null,
      health,
      logPath: LOG_PATH,
    });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const meta = await clientMeta();
    const body = (await req.json().catch(() => ({}))) as { action?: string };

    if (body.action === "stop") {
      if (child) {
        try { child.kill("SIGTERM"); } catch {}
        child = null;
        await audit({ actorId: admin.id, actorRole: "ADMIN", action: "GATEWAY_STOPPED", targetType: "Service", targetId: `gateway:${PORT}`, ip: meta.ip });
        return jsonOk({ ok: true, stopped: true });
      }
      return jsonOk({ ok: true, stopped: false, reason: "gateway was not started by this control plane" });
    }

    // Default action: start.
    if (await portListening(PORT)) {
      return jsonOk({ ok: true, alreadyRunning: true, port: PORT });
    }
    if (!fs.existsSync(GATEWAY_ENTRY)) {
      return jsonOk({ error: { code: "NOT_FOUND", message: "gateway entry file missing" } }, { status: 500 });
    }
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    const out = fs.openSync(LOG_PATH, "a");
    // Prefer the bun runtime (fast startup, proven here); fall back to Node's
    // TypeScript type stripping. Both run the same socket.io code path.
    const bunPath = await new Promise<string | null>((resolve) => {
      const p = spawn("which", ["bun"]);
      let out = "";
      p.stdout.on("data", (d) => { out += String(d); });
      p.on("close", () => resolve(out.trim() || null));
      p.on("error", () => resolve(null));
    });
    const useBun = !!bunPath;
    const bin = useBun ? bunPath! : "node";
    const args = useBun ? [GATEWAY_ENTRY] : ["--experimental-strip-types", GATEWAY_ENTRY];
    child = spawn(bin, args, {
      cwd: GATEWAY_DIR,
      env: { ...process.env, VOXCORE_GATEWAY_PORT: String(PORT) },
      stdio: ["ignore", out, out],
      detached: true,
    });
    child.unref?.();
    child.on("exit", (code) => { child = null; void code; });
    // Give it a moment, then verify the port actually opened.
    await new Promise((r) => setTimeout(r, 1500));
    const listening = await portListening(PORT);
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: "GATEWAY_STARTED", targetType: "Service", targetId: `gateway:${PORT}`, after: { bin, pid: child?.pid ?? null, listening }, ip: meta.ip });
    if (!listening) {
      return jsonOk({ ok: false, error: `gateway did not open port ${PORT}; check ${LOG_PATH}` }, { status: 502 });
    }
    return jsonOk({ ok: true, pid: child?.pid ?? null, bin, port: PORT });
  },
  { rule: "adminWrite" }
);
