import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, hashToken } from "@/lib/crypto";
import { unauthorized, forbidden } from "@/lib/errors";
import { securityEvent } from "@/lib/audit";

// Credential auth with server-side sessions. Passwords: bcrypt (cost 12).
// Sessions: opaque random tokens, only SHA-256 hashes stored, httpOnly cookie.

export type Role = "USER" | "SUPPORT" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: string;
  emailVerifiedAt: Date | null;
}

const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const PASSWORD_MIN_LENGTH = 10;

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`Must be at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[a-z]/.test(password)) problems.push("Must contain a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("Must contain an uppercase letter");
  if (!/[0-9]/.test(password)) problems.push("Must contain a digit");
  return problems;
}

export async function createAuthSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null; deviceLabel?: string | null }
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 3600 * 1000);
  await db.authSession.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      deviceLabel: meta.deviceLabel ?? deriveDeviceLabel(meta.userAgent ?? null),
      expiresAt,
    },
  });
  return { token, expiresAt };
}

function deriveDeviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();
  const os = ua.includes("windows") ? "Windows" : ua.includes("android") ? "Android" : ua.includes("iphone") || ua.includes("ipad") ? "iOS" : ua.includes("mac") ? "macOS" : ua.includes("linux") ? "Linux" : "Unknown OS";
  const browser = ua.includes("edg/") ? "Edge" : ua.includes("chrome") ? "Chrome" : ua.includes("firefox") ? "Firefox" : ua.includes("safari") ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

export function sessionCookieOptions(expires: Date) {
  return {
    name: env.sessionCookieName,
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict" as const,
    expires,
    path: "/",
  };
}

// Resolve the current user from the session cookie. Returns null when absent.
export async function currentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(env.sessionCookieName)?.value;
  if (!token) return null;
  return userFromSessionToken(token);
}

export async function userFromSessionToken(token: string): Promise<AuthUser | null> {
  const session = await db.authSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status === "DELETED") return null;
  // Touch lastSeenAt at most once per minute to limit writes.
  if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
    await db.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await currentUser();
  if (!user) throw unauthorized();
  if (user.status === "SUSPENDED") throw forbidden("Account suspended. Contact support.");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<AuthUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    await securityEvent({
      kind: "PERMISSION_DENIED",
      userId: user.id,
      severity: "WARN",
      detail: { required: roles, actual: user.role },
    });
    throw forbidden();
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  return requireRole("ADMIN");
}

export async function requireSupportOrAdmin(): Promise<AuthUser> {
  return requireRole("SUPPORT", "ADMIN");
}

export async function clientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return { ip, userAgent: h.get("user-agent") };
}

// CSRF protection: for state-changing requests, verify the Origin header matches
// the Host. Combined with SameSite=strict cookies this blocks cross-site posts.
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return; // same-origin fetches without origin header (e.g. some tools)
  const host = h.get("host");
  try {
    const originHost = new URL(origin).host;
    if (host && originHost !== host) {
      await securityEvent({ kind: "CSRF_REJECTED", severity: "WARN", detail: { origin, host } });
      throw forbidden("Cross-origin request rejected");
    }
  } catch (e) {
    if ((e as Error).message === "Cross-origin request rejected") throw e;
    throw forbidden("Invalid origin header");
  }
}
