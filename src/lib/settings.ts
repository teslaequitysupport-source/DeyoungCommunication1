import { db } from "@/lib/db";
import { env } from "@/lib/env";

// Site settings and feature flags, cached in-process with a short TTL.
// Admin publishes changes through the settings API which writes a version
// history entry (PUBLISH or ROLLBACK) for audit purposes.

export interface PublicSiteConfig {
  siteName: string;
  tagline: string;
  announcement: string | null;
  announcementLevel: "INFO" | "WARN";
  maintenanceMode: boolean;
  studioEnabled: boolean;
  uploadsEnabled: boolean;
  registrationEnabled: boolean;
  supportEnabled: boolean;
  animationIntensity: "OFF" | "SUBTLE" | "FULL";
  // Env-derived, never stored in the DB: Google sign-in is only advertised
  // when the deployment actually configured the OAuth client.
  googleEnabled: boolean;
}

const DEFAULTS: PublicSiteConfig = {
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
  googleEnabled: false,
};

export const SETTING_KEY = "public.site";

type CacheEntry = { value: PublicSiteConfig; expires: number };
let cache: CacheEntry | null = null;

export async function getSiteConfig(force = false): Promise<PublicSiteConfig> {
  if (!force && cache && cache.expires > Date.now()) return cache.value;
  try {
    const row = await db.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    const value = row ? { ...DEFAULTS, ...(JSON.parse(row.value) as Partial<PublicSiteConfig>) } : DEFAULTS;
    // googleEnabled is env-derived: always recompute, never trust stored JSON.
    value.googleEnabled = env.googleEnabled;
    cache = { value, expires: Date.now() + 15_000 };
    return value;
  } catch {
    return DEFAULTS;
  }
}

export function invalidateSiteConfig(): void {
  cache = null;
}

export async function isFlagEnabled(key: string, fallback = false): Promise<boolean> {
  try {
    const row = await db.featureFlag.findUnique({ where: { key } });
    return row ? row.enabled : fallback;
  } catch {
    return fallback;
  }
}
