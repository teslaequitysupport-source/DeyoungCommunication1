"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, CatalogModel, Me, PlanInfo } from "@/lib/client/api";
import { SiteConfig } from "@/components/app/app-shell";

// Landing: honest product story. No invented stats, no testimonials, no fake
// logos. What ships today is stated plainly; what is not verified is labeled.

const COMPAT_MATRIX = [
  { target: "Browser apps (this studio)", status: "SUPPORTED", note: "Chrome, Edge, Firefox: mic capture and converted playback in-browser, measured live in the studio." },
  { target: "Discord / OBS / Zoom (Windows)", status: "DESKTOP COMPANION", note: "Requires the Windows client with a virtual microphone (VB-CABLE route). Planned phase 2; not shipped in this build." },
  { target: "Third-party apps (Android)", status: "PARTIAL", note: "Android 10+ restricts unverified microphone injection. In-app conversion works; system-wide routing does not." },
  { target: "Third-party apps (iOS)", status: "UNSUPPORTED", note: "iOS sandboxing does not permit replacing the system microphone. In-app conversion only." },
];

export default function LandingView({ navigate, config, user }: { navigate: (to: string) => void; config: SiteConfig | null; user: Me["user"] }) {
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);

  useEffect(() => {
    apiGet<{ models: CatalogModel[] }>("/api/models").then((d) => setModels(d.models)).catch(() => {});
    apiGet<{ plans: PlanInfo[] }>("/api/billing/plans").then((d) => setPlans(d.plans)).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-5 border-violet-800 bg-violet-950/40 text-violet-300">
              Infrastructure core &middot; live now
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Your voice, another voice, in real time
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-zinc-600 dark:text-zinc-400">
              {config?.tagline ?? "Real-time AI voice conversion platform"}. Speak into your microphone and hear a converted voice come back through a GPU worker fleet, a self-healing scheduler and a scale-to-zero cost model. Every latency figure you will see in this product is measured, not marketed.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {user ? (
                <Button size="lg" className="bg-violet-600 hover:bg-violet-500" onClick={() => navigate("studio")}>Open the studio</Button>
              ) : (
                <Button size="lg" className="bg-violet-600 hover:bg-violet-500" onClick={() => navigate("auth/register")}>Create free account</Button>
              )}
              <Button size="lg" variant="outline" onClick={() => navigate("models")}>Browse voices</Button>
            </div>
            <p className="mt-4 text-xs text-zinc-400">
              Registration requires email verification. This deployment has SMTP disabled, so verification tokens are shown once at signup (documented dev-mode behavior).
            </p>
          </div>

          {/* Pipeline strip */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {["Microphone", "Capture 16 kHz", "Audio gateway", "Worker fleet", "Conversion", "Playback"].map((step, i) => (
                <div key={step} className="relative rounded-lg border border-zinc-200 bg-white/70 px-3 py-3 text-center text-xs font-medium dark:border-zinc-800 dark:bg-zinc-900/70">
                  <span className="absolute left-2 top-2 font-mono text-[10px] text-violet-500">{String(i + 1).padStart(2, "0")}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What is real */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">What is real in this build</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          This platform is an infrastructure-first build: the fleet, the scheduler, the metering and the moderation pipeline are the product. Here is exactly what works today.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Real-time studio",
              body: "Browser microphone capture, 128 ms chunks over an authenticated WebSocket gateway, converted playback with live latency percentiles (P50/P95) and packet statistics measured per session.",
            },
            {
              title: "Worker fleet and scheduler",
              body: "Workers self-register with hardware truth (GPU, VRAM, tiers), heartbeat with real telemetry, and are scored by the scheduler on warmth, residency, capacity and cost. Lost workers fail over automatically.",
            },
            {
              title: "Scale-to-zero economics",
              body: "Paid capacity is capped by administrator budgets with WARN, QUEUE_ONLY and EMERGENCY_STOP responses. Idle paid workers are stopped automatically. Free providers cost nothing and say so.",
            },
            {
              title: "Open uploads with moderation",
              body: "RVC .pth uploads carry a mandatory rights attestation, license metadata, sha256 dedup and a human moderation queue. Takedown is immediate and audited. The server never unpickles uploads.",
            },
            {
              title: "Metered credits, deferred charging",
              body: "A complete credit ledger with idempotent mutations and server-side usage metering is live. No payment provider is wired yet, so nothing is ever charged; prices remain unpublished by design.",
            },
            {
              title: "Command centre",
              body: "A separate /admin control plane with its own dark interface: fleet control, provisioning, moderation, users, budgets, audit chain verification, security events and a real test lab.",
            },
          ].map((f) => (
            <Card key={f.title} className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600 dark:text-zinc-400">{f.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Voices preview */}
      <section className="border-y border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Voice catalog</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Built-in DSP voices are live now. Community RVC uploads appear here after passing moderation.</p>
            </div>
            <Button variant="outline" onClick={() => navigate("models")}>View all</Button>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {models.slice(0, 4).map((m) => (
              <Card key={m.id} className="border-zinc-200 dark:border-zinc-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{m.name}</CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">{m.engine}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2 text-xs">{m.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-zinc-500">
                  License: {m.licenseName}{m.licenseVerified ? " (verified)" : " (unverified)"}
                </CardContent>
              </Card>
            ))}
            {models.length === 0 ? (
              <p className="text-sm text-zinc-500">No approved models yet.</p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Compatibility */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Compatibility, stated honestly</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
          We will never write &quot;works with everything&quot;. Every target below carries its true status and the reason why.
        </p>
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {COMPAT_MATRIX.map((row) => (
                <tr key={row.target} className="bg-white dark:bg-zinc-950">
                  <td className="px-4 py-3 font-medium">{row.target}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Plans */}
      <section className="border-t border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-2xl font-semibold tracking-tight">Plans</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
            Prices are intentionally unpublished: they will be set from the measured GPU cost model, not invented. Limits below are real and enforced server-side. Credits are administratively granted in this deployment; no payment can be taken.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <Card key={p.code} className="border-zinc-200 dark:border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-baseline justify-between text-base">
                    {p.name}
                    <span className="text-sm font-normal text-zinc-400">{p.priceCents === null ? "pricing pending" : `$${(p.priceCents / 100).toFixed(0)}/mo`}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <p>{p.maxConcurrentSessions} concurrent session(s)</p>
                  <p>{p.maxMinutesPerDay} min/day &middot; {p.maxMinutesPerMonth} min/month</p>
                  <p>{p.maxModelUploads} upload slot(s)</p>
                  <p>Tiers: {p.allowedTiers.join(", ")}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Try the pipeline yourself</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          Create an account, open the studio and speak. The latency numbers you will see are measured from your own session, chunk by chunk.
        </p>
        <Button size="lg" className="mt-6 bg-violet-600 hover:bg-violet-500" onClick={() => navigate(user ? "studio" : "auth/register")}>
          {user ? "Open the studio" : "Create free account"}
        </Button>
      </section>
    </div>
  );
}
