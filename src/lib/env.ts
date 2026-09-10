// Central environment configuration.
// All tunables live here or in the database (BudgetPolicy, SiteSetting, FeatureFlag).
// Secrets are read from env vars and are never committed. See docs/48-DEPLOYMENT.md.

function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",

  // App origin used in links (verification emails in production).
  appOrigin: process.env.APP_ORIGIN || "http://localhost:3000",

  // Signing secret for short-lived session gateway tokens (JWT-style, HS256 via node crypto).
  gatewaySecret:
    process.env.GATEWAY_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-only-gateway-secret-change-me",

  // Session cookie name and lifetime.
  sessionCookieName: "voxcore_session",
  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 24 * 14),

  // Email delivery mode. "none" means the platform cannot send mail: verification
  // and password reset tokens are surfaced through the dev-mode response and the
  // admin panel instead. This is an explicit, visible limitation, never hidden.
  emailMode: process.env.EMAIL_MODE || "none", // none | smtp (smtp reserved for deployment)

  // Upload constraints for voice model files.
  maxModelUploadMb: num(process.env.MAX_MODEL_UPLOAD_MB, 300),

  // Worker protocol.
  workerHeartbeatTimeoutSec: num(process.env.WORKER_HEARTBEAT_TIMEOUT_SEC, 60),
  workerTokenPrefix: "vcw_",

  // Audio transport defaults.
  audioSampleRate: num(process.env.AUDIO_SAMPLE_RATE, 16000),
  audioChunkMs: num(process.env.AUDIO_CHUNK_MS, 128),

  // Bootstrap admin (consumed by the seed script only).
  bootstrapAdminEmail: process.env.ADMIN_EMAIL || "",
  bootstrapAdminPassword: process.env.ADMIN_PASSWORD || "",
} as const;
