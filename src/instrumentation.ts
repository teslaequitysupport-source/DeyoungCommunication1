// Background maintenance loop (Node.js runtime only).
// Responsibilities (all real, all observable in the admin panel):
// - Detect stale workers (missed heartbeats) and mark them UNHEALTHY
// - Fail over: end or requeue sessions that were bound to a lost worker
// - Scale-to-zero sweep for idle PAID workers (FREE workers are never charged)
// - Budget threshold checks
// - Monthly plan credit allowance grants (idempotent per user per month)
// - Retention pruning: heartbeats, request metrics, rate limit windows, tokens

const TICK_MS = 30_000;

export async function register() {
  // Never run during build phase and only in the Node.js runtime (this code
  // uses fs/child_process through the provider layer, which Edge cannot load).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const mod = await import("@/lib/maintenance");
  mod.startMaintenanceLoop(TICK_MS);
}
