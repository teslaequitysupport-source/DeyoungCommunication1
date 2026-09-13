// In-memory ring buffer of unhandled route errors (HTTP 500s).
//
// Purpose: the deployment may be operated without access to platform logs
// (Railway log retention, shared terminals, etc.). When a route handler
// throws, the wrapper records the failure here so the operator brief can
// show the exact failing route, message and stack INSIDE the product,
// admin-gated. This turns "Internal server error" from a dead end into a
// one-look diagnosis. Bounded to the last N errors, capped strings.

export interface ErrorRingEntry {
  at: string; // ISO timestamp
  route: string;
  method: string;
  message: string;
  stack: string | null;
}

const CAP = 20;
const MAX_MSG = 300;
const MAX_STACK = 2000;
const ring: ErrorRingEntry[] = [];

export function recordRouteError(route: string, method: string, err: unknown): void {
  const message = String((err as Error)?.message ?? err).slice(0, MAX_MSG);
  const stack = ((err as Error)?.stack ?? null)?.slice(0, MAX_STACK) ?? null;
  ring.push({ at: new Date().toISOString(), route, method, message, stack });
  if (ring.length > CAP) ring.splice(0, ring.length - CAP);
}

export function recentRouteErrors(sinceMs = 24 * 3600 * 1000): ErrorRingEntry[] {
  const cutoff = Date.now() - sinceMs;
  return ring.filter((e) => Date.parse(e.at) >= cutoff);
}
