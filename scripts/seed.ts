// Seed script: idempotent. Run: bun scripts/seed.ts
// Creates: providers, plans (prices unset by design), system DSP voice models,
// budget policy, feature flags, site settings, and the bootstrap admin from
// env (ADMIN_EMAIL + ADMIN_PASSWORD). Bootstrap only happens when no admin
// exists yet; the password is hashed with bcrypt cost 12.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("seed: starting");

  // Providers -------------------------------------------------------------
  await db.provider.upsert({
    where: { code: "LOCAL" },
    create: {
      code: "LOCAL", name: "Local machine", costKind: "FREE", automation: "AUTONOMOUS",
      rateMilliUsdPerHour: 0,
      notes: "Spawns the Python worker agent on this machine. Zero infrastructure cost.",
    },
    update: {},
  });
  await db.provider.upsert({
    where: { code: "KAGGLE_ASSISTED" },
    create: {
      code: "KAGGLE_ASSISTED", name: "Kaggle notebook (assisted)", costKind: "FREE", automation: "ASSISTED",
      rateMilliUsdPerHour: 0,
      notes: "Generates a paste-ready notebook cell. Kaggle cannot be launched programmatically; sessions are capped (~30 GPU-hours/week, hours per session). Termination is treated as normal failure.",
    },
    update: {},
  });

  // Plans (no invented prices: priceCents stays null until the cost model lands)
  const plans = [
    { code: "FREE", name: "Free", sort: 0, maxConcurrentSessions: 1, maxMinutesPerDay: 10, maxMinutesPerMonth: 60, maxModelUploads: 1, monthlyFreeCreditCents: 0, priority: 0, allowedTiers: ["DSP_CPU"], description: "DSP-tier conversion, community catalog, 10 min per day." },
    { code: "PRO", name: "Pro", sort: 1, maxConcurrentSessions: 1, maxMinutesPerDay: 60, maxMinutesPerMonth: 600, maxModelUploads: 3, monthlyFreeCreditCents: 500, priority: 10, allowedTiers: ["DSP_CPU"], description: "Higher limits and 3 upload slots. GPU tier access arrives with real GPU capacity." },
    { code: "PREMIUM", name: "Premium", sort: 2, maxConcurrentSessions: 2, maxMinutesPerDay: 180, maxMinutesPerMonth: 2000, maxModelUploads: 10, monthlyFreeCreditCents: 1500, priority: 20, allowedTiers: ["DSP_CPU", "RVC_GPU"], description: "GPU-tier ready, priority scheduling, 10 upload slots." },
    { code: "BUSINESS", name: "Business", sort: 3, maxConcurrentSessions: 4, maxMinutesPerDay: 480, maxMinutesPerMonth: 8000, maxModelUploads: 25, monthlyFreeCreditCents: 5000, priority: 30, allowedTiers: ["DSP_CPU", "RVC_GPU"], description: "Highest limits and priority for production workflows." },
  ];
  for (const p of plans) {
    await db.plan.upsert({
      where: { code: p.code },
      create: { ...p, allowedTiers: JSON.stringify(p.allowedTiers) },
      update: {},
    });
  }

  // System DSP voice models: real built-in conversions of the worker agent
  const dspModels = [
    { name: "Neutral (built-in DSP)", pitchSemitones: 0, formant: 1.0, description: "Bypass conversion: true passthrough through the real-time pipeline. Useful for latency measurement and pipeline verification." },
    { name: "Alto Shift (built-in DSP)", pitchSemitones: -3, formant: 0.92, description: "Shifts the voice down three semitones with a darker spectral tilt. DSP engine, runs anywhere, no GPU required." },
    { name: "Bright Shift (built-in DSP)", pitchSemitones: 4, formant: 1.12, description: "Lifts the voice four semitones with a brighter tilt. DSP engine, runs anywhere, no GPU required." },
  ];
  for (const m of dspModels) {
    const existing = await db.voiceModel.findFirst({ where: { name: m.name, kind: "SYSTEM_DSP" } });
    if (!existing) {
      await db.voiceModel.create({
        data: {
          name: m.name,
          kind: "SYSTEM_DSP",
          engine: "DSP",
          status: "APPROVED",
          licenseName: "BUILT-IN",
          licenseVerified: true,
          description: m.description,
          engineParams: JSON.stringify({ pitchSemitones: m.pitchSemitones, formant: m.formant }),
          sampleRate: 16000,
        },
      });
    }
  }

  // Budget policy (global, conservative defaults; admin-tunable)
  const globalBudget = await db.budgetPolicy.findFirst({ where: { scope: "GLOBAL" } });
  if (!globalBudget) {
    await db.budgetPolicy.create({
      data: {
        scope: "GLOBAL",
        dailyBudgetCents: 100,
        monthlyBudgetCents: 1000,
        maxConcurrentPaidWorkers: 1,
        maxPaidSessions: 2,
        onThreshold: "QUEUE_ONLY",
        emergencyStop: false,
      },
    });
  }

  // Feature flags
  const flags = [
    { key: "studio.realtime", enabled: true, description: "Browser real-time studio (mic capture to converted playback)" },
    { key: "workers.scaleToZero", enabled: true, description: "Automatic stop of idle PAID workers" },
    { key: "moderation.autoHold", enabled: true, description: "New uploads require manual admin approval" },
  ];
  for (const f of flags) {
    await db.featureFlag.upsert({ where: { key: f.key }, create: f, update: {} });
  }

  // Site settings
  const site = await db.siteSetting.findUnique({ where: { key: "public.site" } });
  if (!site) {
    await db.siteSetting.create({
      data: {
        key: "public.site",
        value: JSON.stringify({
          siteName: "VoxCore",
          tagline: "Real-time AI voice conversion platform",
          announcement: null,
          announcementLevel: "INFO",
          maintenanceMode: false,
          studioEnabled: true,
          uploadsEnabled: true,
          registrationEnabled: true,
          supportEnabled: true,
          animationIntensity: "SUBTLE",
        }),
      },
    });
  }

  // Bootstrap admin (only when no admin exists)
  const adminCount = await db.user.count({ where: { role: "ADMIN" } });
  if (adminCount === 0) {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        console.error("seed: ADMIN_PASSWORD does not meet the policy (10+ chars, upper, lower, digit). Admin NOT created.");
      } else {
        const passwordHash = await bcrypt.hash(password, 12);
        await db.user.create({
          data: {
            email: email.toLowerCase(),
            passwordHash,
            name: "Platform Administrator",
            role: "ADMIN",
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        });
        console.log(`seed: bootstrap admin created: ${email}`);
      }
    } else {
      console.log("seed: no ADMIN_EMAIL/ADMIN_PASSWORD in env; create an admin by rerunning seed with those env vars");
    }
  }

  console.log("seed: done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
