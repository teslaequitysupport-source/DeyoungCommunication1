import { z } from "zod";

// Shared request validation schemas. Every route validates its input with zod;
// these are the reusable fragments so rules stay consistent platform-wide.

export const emailSchema = z.string().trim().toLowerCase().email().max(200);
export const passwordSchema = z
  .string()
  .min(10, "At least 10 characters")
  .max(200)
  .regex(/[a-z]/, "Needs a lowercase letter")
  .regex(/[A-Z]/, "Needs an uppercase letter")
  .regex(/[0-9]/, "Needs a digit");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(80).optional(),
  acceptTerms: z.literal(true, { message: "You must accept the Terms and Privacy Policy" }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const tierSchema = z.enum(["AUTO", "DSP_CPU", "RVC_GPU"]);

export const sessionStartSchema = z.object({
  modelId: z.string().min(1),
  requestedTier: tierSchema.default("AUTO"),
});

export const modelUploadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional(),
  engine: z.literal("RVC"),
  licenseName: z.string().trim().min(2).max(120),
  licenseUrl: z.string().url().max(500).optional().or(z.literal("")),
  rightsAttested: z.literal(true, { message: "Rights attestation is required" }),
  licenseVerified: z.boolean().default(false),
});

export const reportSchema = z.object({
  reason: z.enum(["IMPERSONATION", "NO_RIGHTS", "FRAUD", "HARASSMENT", "OTHER"]),
  detail: z.string().trim().max(2000).optional(),
});

export const ticketCreateSchema = z.object({
  subject: z.string().trim().min(4).max(150),
  body: z.string().trim().min(10).max(5000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export const ticketReplySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  internal: z.boolean().default(false),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]).optional(),
});

export const adminModelActionSchema = z.object({
  action: z.enum(["approve", "reject", "disable", "takedown", "enable"]),
  reason: z.string().trim().max(1000).optional(),
});

export const adminUserActionSchema = z.object({
  action: z.enum(["suspend", "restore", "delete", "grant-credits", "adjust-plan", "force-logout"]),
  amountCents: z.number().int().optional(),
  planCode: z.string().trim().max(30).optional(),
  note: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(500).optional(),
});

export const adminWorkerActionSchema = z.object({
  action: z.enum(["drain", "quarantine", "restart", "stop", "activate", "ping"]),
  reason: z.string().trim().max(500).optional(),
});

export const provisionSchema = z.object({
  providerCode: z.enum(["LOCAL", "KAGGLE_ASSISTED"]),
  name: z.string().trim().max(60).optional(),
  tier: z.enum(["DSP_CPU", "RVC_GPU"]).default("DSP_CPU"),
});

export const budgetSchema = z.object({
  scope: z.enum(["GLOBAL", "PROVIDER"]),
  providerCode: z.string().trim().max(30).optional(),
  dailyBudgetCents: z.number().int().min(0).nullable().optional(),
  monthlyBudgetCents: z.number().int().min(0).nullable().optional(),
  maxConcurrentPaidWorkers: z.number().int().min(0).nullable().optional(),
  maxPaidSessions: z.number().int().min(0).nullable().optional(),
  onThreshold: z.enum(["WARN", "QUEUE_ONLY", "EMERGENCY_STOP"]),
  emergencyStop: z.boolean().default(false),
});

export const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().min(1).max(160),
  announcement: z.string().trim().max(300).nullable(),
  announcementLevel: z.enum(["INFO", "WARN"]),
  maintenanceMode: z.boolean(),
  studioEnabled: z.boolean(),
  uploadsEnabled: z.boolean(),
  registrationEnabled: z.boolean(),
  supportEnabled: z.boolean(),
  animationIntensity: z.enum(["OFF", "SUBTLE", "FULL"]),
});

export const flagSchema = z.object({
  key: z.string().trim().min(2).max(60),
  enabled: z.boolean(),
  description: z.string().trim().max(300).optional(),
});

export const planPatchSchema = z.object({
  code: z.string(),
  priceCents: z.number().int().min(0).nullable().optional(),
  monthlyFreeCreditCents: z.number().int().min(0).optional(),
  maxConcurrentSessions: z.number().int().min(1).max(20).optional(),
  maxMinutesPerDay: z.number().int().min(1).max(1440).optional(),
  maxMinutesPerMonth: z.number().int().min(1).max(44640).optional(),
  maxModelUploads: z.number().int().min(0).max(100).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  allowedTiers: z.array(z.enum(["DSP_CPU", "RVC_GPU"])).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(500).optional(),
});

export const workerRegisterSchema = z.object({
  regToken: z.string().min(10).max(200),
  name: z.string().trim().min(1).max(80).optional(),
  region: z.string().trim().max(60).optional(),
  gpuName: z.string().trim().max(60).nullish(),
  vramMb: z.number().int().min(0).nullish(),
  ramMb: z.number().int().min(0).nullish(),
  cpuCores: z.number().int().min(0).nullish(),
  os: z.string().trim().max(60).nullish(),
  cudaVersion: z.string().trim().max(30).nullish(),
  pythonVersion: z.string().trim().max(30).nullish(),
  agentVersion: z.string().trim().max(30).nullish(),
  tiers: z.array(z.enum(["DSP_CPU", "RVC_GPU"])).min(1),
  capabilities: z.record(z.string(), z.unknown()).default({}),
  maxSessions: z.number().int().min(1).max(64).default(2),
});

export const heartbeatSchema = z.object({
  status: z.enum(["BOOTING", "LOADING_MODEL", "WARMING", "READY", "ACTIVE", "IDLE", "DRAINING", "STOPPING", "UNHEALTHY", "FAILED", "RESTARTING"]),
  gpuUtilPct: z.number().min(0).max(100).nullish(),
  vramUsedMb: z.number().int().min(0).nullish(),
  ramUsedMb: z.number().int().min(0).nullish(),
  cpuUtilPct: z.number().min(0).max(100).nullish(),
  activeSessions: z.number().int().min(0).default(0),
  inferP50Ms: z.number().min(0).nullish(),
  inferP95Ms: z.number().min(0).nullish(),
  errorCount: z.number().int().min(0).default(0),
  uptimeSec: z.number().int().min(0).nullish(),
  loadedModels: z.array(z.string()).default([]),
});

export const workerEventSchema = z.object({
  level: z.enum(["INFO", "WARN", "ERROR"]).default("INFO"),
  kind: z.string().trim().min(1).max(60),
  message: z.string().trim().min(1).max(2000),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const sessionMetricsSchema = z.object({
  p50Ms: z.number().min(0),
  p95Ms: z.number().min(0),
  packetsSent: z.number().int().min(0).default(0),
  packetsReceived: z.number().int().min(0).default(0),
  dropsPct: z.number().min(0).max(100).default(0),
});
