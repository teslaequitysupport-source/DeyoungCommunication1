import crypto from "crypto";

// Token helpers. Raw tokens are shown once; only SHA-256 hashes are stored.

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashToken(token: string): string {
  return sha256(token);
}

// Constant-time string comparison for secret material.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// HMAC signature for worker->backend critical operations.
export function hmac(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// Short-lived signed token for the session audio gateway (compact JWT-like).
// Header/payload/signature, base64url, HS256. Verified by the gateway service
// without any database access.
export interface GatewayClaims {
  sid: string; // session id
  uid: string; // user id
  wid: string; // worker id
  mid: string; // model id
  role: "client" | "worker";
  exp: number; // epoch seconds
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signGatewayToken(claims: GatewayClaims, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyGatewayToken(token: string, secret: string): GatewayClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as GatewayClaims;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
