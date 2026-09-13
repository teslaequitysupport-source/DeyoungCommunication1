"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiGet, CatalogModel, Me, PlanInfo, ApiClientError } from "@/lib/client/api";
import { SiteConfig } from "@/components/app/app-shell";
import Vox3D from "@/components/app/vox-3d";
import { TiltCard, Reveal } from "@/components/app/ui-bits";
import {
  AudioWaveform, ServerCog, ShieldCheck, UploadCloud, Gauge,
  ArrowRight, ChevronDown, EyeOff, Scale, ScanEye, FileLock2, DatabaseZap,
} from "lucide-react";

// The homepage: a full-length, 3D-animated product surface in strict
// red / black / white. Copy follows the honest-engineering rules: no
// invented metrics, no testimonials, no fake logos. What is not shipped
// is labeled, not advertised.

const COMPAT_MATRIX = [
  { target: "Browser apps (this studio)", status: "SUPPORTED", note: "Chrome, Edge, Firefox: microphone capture and converted playback in-browser, measured live in the studio." },
  { target: "Discord / OBS / Zoom (Windows)", status: "DESKTOP COMPANION", note: "Requires the Windows client with a virtual microphone (VB-CABLE route). Planned phase 2; not shipped in this build." },
  { target: "Third-party apps (Android)", status: "PARTIAL", note: "Android 10+ restricts unverified microphone injection. In-app conversion works; system-wide routing does not." },
  { target: "Third-party apps (iOS)", status: "UNSUPPORTED", note: "iOS sandboxing does not permit replacing the system microphone. In-app conversion only." },
];

const TICKER = [
  "128 MS CHUNK CADENCE",
  "MEASURED P50 / P95 LATENCY",
  "OPEN MODEL UPLOADS",
  "HUMAN MODERATION",
  "AUDITED TAKEDOWNS",
  "SCALE-TO-ZERO ECONOMICS",
  "SERVER-SIDE RATE LIMITING",
  "NO FABRICATED METRICS",
];

const FEATURES = [
  {
    icon: AudioWaveform,
    title: "Real-time studio",
    body: "Browser microphone capture, 128 ms chunks over an authenticated WebSocket gateway, converted playback with live latency percentiles (P50/P95) and packet statistics measured per session.",
  },
  {
    icon: ServerCog,
    title: "Worker fleet & scheduler",
    body: "Workers self-register with hardware truth (GPU, VRAM, tiers), heartbeat with real telemetry, and are scored on warmth, residency, capacity and cost. Lost workers fail over automatically.",
  },
  {
    icon: Gauge,
    title: "Scale-to-zero economics",
    body: "Paid capacity is capped by administrator budgets with WARN, QUEUE_ONLY and EMERGENCY_STOP responses. Idle paid workers are stopped automatically. Free providers cost nothing and say so.",
  },
  {
    icon: UploadCloud,
    title: "Open uploads, moderated",
    body: "RVC .pth uploads carry a mandatory rights attestation, license metadata, sha256 dedup and a human moderation queue. Takedown is immediate and audited. The server never unpickles uploads.",
  },
  {
    icon: DatabaseZap,
    title: "Metered credits, no charging",
    body: "A complete credit ledger with idempotent mutations and server-side usage metering is live. No payment provider is wired yet, so nothing is ever charged; prices remain unpublished by design.",
  },
  {
    icon: ShieldCheck,
    title: "Command centre",
    body: "A separate /admin control plane: fleet control, provisioning, moderation, users, budgets, audit chain verification, security events and a real test lab. Access is gated and every attempt is logged.",
  },
];

const PIPELINE = [
  { name: "Microphone capture", body: "Your voice enters the browser at 16 kHz mono through a worklet - nothing is recorded to disk." },
  { name: "Chunking", body: "Audio is cut into 128 ms frames. This cadence is the heartbeat of the whole pipeline." },
  { name: "Authenticated gateway", body: "Chunks travel over a short-lived-token WebSocket. No token, no socket - the gateway drops unauthenticated traffic." },
  { name: "Scheduler & pairing", body: "The scheduler scores every worker on warmth, residency, capacity and cost, then assigns your session." },
  { name: "Conversion", body: "DSP voices convert on the in-container CPU worker live. RVC voices convert on GPU workers, burst-only by design." },
  { name: "Playback & measurement", body: "Converted audio returns chunk by chunk. Your session shows its own P50/P95 - measured, never estimated." },
];

const GUARDRAILS = [
  { icon: Scale, title: "Rights attestation", body: "Every upload requires a signed declaration that the uploader holds the rights to the voice. No attestation, no review." },
  { icon: ScanEye, title: "Human moderation", body: "Models publish only after a human approves them. Abuse reports route to the same queue with immediate takedown." },
  { icon: FileLock2, title: "No unpickling", body: "The server never executes or deserializes uploaded model files. Inspection happens out-of-process, if at all." },
  { icon: ShieldCheck, title: "Audit chain", body: "Security events, admin actions and model lifecycle changes are append-only and verifiable end to end." },
];

interface LimitRule { key: string; bucket: string; limit: number; windowSec: number }
interface LimitsResponse { enforcement: string; abuse: string; rules: LimitRule[] }
interface OperatorBrief {
  generatedAt: string;
  counts: {
    users: { total: number; suspended: number };
    models: { pendingReview: number; approved: number; takenDown: number };
    workers: { total: number; byStatus: Record<string, number> };
    sessions: { active: number };
    queue: { waiting: number };
    tickets: { unresolved: number };
    security: { rateLimited24h: number; permissionDenied24h: number };
    traffic: { requests24h: number };
  };
  env: {
    nodeEnv: string; adminEmailSet: boolean; adminPasswordSet: boolean;
    googleEnabled: boolean; emailMode: string; appOrigin: string;
    audioChunkMs: number; maxModelUploadMb: number;
  };
  notes: { id: string; title: string; body: string }[];
}

function fmtWindow(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec / 3600)} h`;
}

function SectionHead({ kicker, title, lede }: { kicker: string; title: React.ReactNode; lede?: string }) {
  return (
    <Reveal>
      <p className="label-kicker text-red-600">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-bold uppercase leading-[1.02] tracking-tight text-white sm:text-5xl">{title}</h2>
      {lede ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">{lede}</p> : null}
    </Reveal>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "SUPPORTED") return <Badge className="border-white bg-white font-mono text-[10px] text-zinc-950 hover:bg-white">{status}</Badge>;
  if (status === "UNSUPPORTED") return <Badge className="border-red-500 bg-red-600 font-mono text-[10px] text-white hover:bg-red-600">{status}</Badge>;
  return <Badge className="border-white/40 bg-transparent font-mono text-[10px] text-zinc-200 hover:bg-transparent">{status}</Badge>;
}

export default function LandingView({ navigate, config, user }: { navigate: (to: string) => void; config: SiteConfig | null; user: Me["user"] }) {
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [limits, setLimits] = useState<LimitsResponse | null>(null);
  const [brief, setBrief] = useState<OperatorBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    apiGet<{ models: CatalogModel[] }>("/api/models").then((d) => setModels(d.models)).catch(() => {});
    apiGet<{ plans: PlanInfo[] }>("/api/billing/plans").then((d) => setPlans(d.plans)).catch(() => {});
    apiGet<LimitsResponse>("/api/public/limits").then(setLimits).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    apiGet<{ brief: OperatorBrief }>("/api/operator/brief")
      .then((d) => setBrief(d.brief))
      .catch((e: unknown) => {
        if (e instanceof ApiClientError) setBriefError(`Brief unavailable: ${e.message}`);
        else setBriefError("Brief unavailable: request failed");
      });
  }, [isAdmin]);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="bg-black">
      {/* ============================= HERO ============================= */}
      <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden border-b border-white/10" id="top">
        <div className="grid-lines grid-lines-fade absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[120px]" aria-hidden />
        <Vox3D className="pointer-events-none absolute inset-0" intensity={config?.animationIntensity} />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-28 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-red-600" aria-hidden />
            <p className="label-kicker text-zinc-300">Real-time voice conversion &middot; infrastructure core &middot; live</p>
          </div>

          <h1 className="mt-8 font-display text-[13vw] font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-7xl lg:text-8xl">
            Your voice,
            <span className="block text-red-600">rebuilt</span>
            <span className="block">in real time.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
            Speak into your microphone and hear a converted voice come back through a GPU worker fleet, a self-healing
            scheduler and a scale-to-zero cost model. Every latency figure you will see in this product is measured,
            not marketed.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            {user ? (
              <Button size="lg" className="glow-red h-12 bg-red-600 px-8 font-display text-sm font-bold uppercase tracking-widest hover:bg-red-500" onClick={() => navigate("studio")}>
                Enter the studio <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" className="glow-red h-12 bg-red-600 px-8 font-display text-sm font-bold uppercase tracking-widest hover:bg-red-500" onClick={() => navigate("auth/register")}>
                Create free account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button size="lg" variant="outline" className="h-12 border-white/30 bg-transparent px-8 font-display text-sm font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black" onClick={() => navigate("models")}>
              Browse voices
            </Button>
            <Button size="lg" variant="ghost" className="h-12 font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white" onClick={() => scrollTo("pipeline")}>
              How it works <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <p className="mt-6 max-w-2xl font-mono text-[11px] leading-relaxed text-zinc-500">
            REGISTRATION REQUIRES EMAIL VERIFICATION. THIS DEPLOYMENT HAS SMTP DISABLED, SO VERIFICATION TOKENS ARE
            SHOWN ONCE AT SIGNUP (DOCUMENTED DEV-MODE BEHAVIOR).
          </p>

          {/* Pipeline strip */}
          <div className="mt-16 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-6">
            {["Microphone", "Capture 16 kHz", "Audio gateway", "Worker fleet", "Conversion", "Playback"].map((step, i) => (
              <div key={step} className="relative bg-black px-4 py-4 transition-colors hover:bg-red-950/30">
                <span className="font-mono text-[10px] text-red-600">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-300">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ TICKER ============================ */}
      <div className="overflow-hidden border-b border-white/10 bg-black py-3" aria-hidden>
        <div className="animate-marquee flex w-max items-center">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={`${item}-${i}`} className="flex items-center font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-400">
              <span className="px-6">{item}</span>
              <span className="text-red-600">&#9670;</span>
            </span>
          ))}
        </div>
      </div>

      {/* ========================== MANIFESTO =========================== */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <Reveal>
            <p className="label-kicker text-red-600">Principle 01 &mdash; no fabrication</p>
            <p className="mt-8 max-w-5xl font-display text-3xl font-medium leading-[1.15] tracking-tight text-white sm:text-5xl">
              Every number here is <span className="text-red-600">measured</span> from real sessions. Every capability
              is labeled <span className="font-mono text-2xl sm:text-3xl">SUPPORTED</span>,{" "}
              <span className="font-mono text-2xl sm:text-3xl">PARTIAL</span> or{" "}
              <span className="font-mono text-2xl sm:text-3xl">UNSUPPORTED</span>. What is not shipped is{" "}
              <span className="text-hollow">not advertised.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ========================== FEATURES ============================ */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="Capabilities"
            title={<>What is real<br />in this build</>}
            lede="This platform is an infrastructure-first build: the fleet, the scheduler, the metering and the moderation pipeline are the product. Here is exactly what works today."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <TiltCard className="group h-full">
                  <div className="corner-frame h-full border border-white/10 bg-card p-6 transition-colors duration-300 group-hover:border-red-600/60 group-hover:glow-red">
                    <div className="flex items-start justify-between">
                      <f.icon className="h-6 w-6 text-red-600" aria-hidden />
                      <span className="font-mono text-xs text-zinc-600 group-hover:text-red-600">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="mt-6 font-display text-lg font-bold uppercase tracking-wide text-white">{f.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{f.body}</p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== PIPELINE ============================ */}
      <section className="border-b border-white/10 bg-black" id="pipeline">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="The path of your voice"
            title={<>Six stages.<br />128 milliseconds.</>}
            lede="The chunk cadence is the heartbeat. Everything below happens continuously while you speak - and every stage reports its own telemetry."
          />
          <div className="mt-14">
            {PIPELINE.map((step, i) => (
              <Reveal key={step.name} delay={i * 60}>
                <div className="group grid grid-cols-[64px_1fr] gap-4 border-t border-white/10 py-8 transition-colors last:border-b hover:bg-red-950/10 sm:grid-cols-[96px_320px_1fr] sm:gap-8 sm:px-4">
                  <span className="font-display text-3xl font-bold text-red-600 sm:text-4xl">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-base font-bold uppercase tracking-wider text-white sm:text-lg">{step.name}</h3>
                  <p className="col-start-2 text-sm leading-relaxed text-zinc-400 sm:col-start-3">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================== RATE LIMITS =========================== */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="Protection"
            title="Under load control"
            lede="Every route on this platform is rate-limited at the server, before business logic runs. The values below are fetched live from this deployment - they are the rules actually in force right now, not a policy statement."
          />
          {limits ? (
            <div className="mt-14 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-5">
              {limits.rules.map((r) => (
                <div key={r.key} className="bg-black p-5 transition-colors hover:bg-red-950/20">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-red-600">{r.bucket}</p>
                  <p className="mt-3 font-display text-2xl font-bold text-white">
                    {r.limit}<span className="ml-1 text-xs font-medium text-zinc-500">/ {fmtWindow(r.windowSec)}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-10 font-mono text-xs text-zinc-500">FETCHING LIVE LIMITS&hellip;</p>
          )}
          {limits ? (
            <div className="mt-6 grid gap-2 font-mono text-[11px] leading-relaxed text-zinc-500 md:grid-cols-2">
              <p className="border-l-2 border-red-600 pl-3">ENFORCEMENT: {limits.enforcement.toUpperCase()}</p>
              <p className="border-l-2 border-white/20 pl-3">ABUSE: {limits.abuse.toUpperCase()}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ====================== VOICE CATALOG =========================== */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHead
              kicker="The catalog"
              title="Voices"
              lede="Built-in DSP voices are live now. Community RVC uploads appear here only after passing human moderation with a verified license."
            />
            <Reveal>
              <Button variant="outline" className="border-white/30 bg-transparent font-display text-xs font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black" onClick={() => navigate("models")}>
                View all <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Reveal>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {models.slice(0, 4).map((m, i) => (
              <Reveal key={m.id} delay={(i % 4) * 70}>
                <TiltCard max={5}>
                  <div className="h-full border border-white/10 bg-card p-5 transition-colors hover:border-red-600/60">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold uppercase tracking-wide text-white">{m.name}</h3>
                      <Badge className="border-red-800 bg-red-950/70 font-mono text-[10px] text-red-400 hover:bg-red-950/70">{m.engine}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">{m.description}</p>
                    <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                      {m.licenseName}{m.licenseVerified ? " · verified" : " · unverified"}
                    </p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
            {models.length === 0 ? (
              <p className="font-mono text-xs text-zinc-500">NO APPROVED MODELS PUBLISHED YET.</p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ===================== COMPATIBILITY ============================ */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="Stated honestly"
            title="Compatibility"
            lede="We will never write &quot;works with everything&quot;. Every target below carries its true status and the reason why."
          />
          <Reveal>
            <div className="mt-14 border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left">
                  <tr>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">Target</th>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">Status</th>
                    <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-zinc-400">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {COMPAT_MATRIX.map((row) => (
                    <tr key={row.target} className="bg-black transition-colors hover:bg-red-950/20">
                      <td className="px-4 py-4 font-medium text-white">{row.target}</td>
                      <td className="px-4 py-4"><StatusChip status={row.status} /></td>
                      <td className="px-4 py-4 text-zinc-400">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================= GUARDRAILS =========================== */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="Guardrails"
            title="Voice is identity"
            lede="Cloned voices are powerful and abusable. The platform treats rights, moderation and auditability as core product features, not compliance decoration."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GUARDRAILS.map((g, i) => (
              <Reveal key={g.title} delay={(i % 4) * 70}>
                <div className="group h-full border border-white/10 bg-card p-6 transition-colors hover:border-red-600/60">
                  <g.icon className="h-6 w-6 text-red-600" aria-hidden />
                  <h3 className="mt-6 font-display text-base font-bold uppercase tracking-wide text-white">{g.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{g.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== PLANS =============================== */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="Commercials"
            title="Plans"
            lede="Prices are intentionally unpublished: they will be set from the measured GPU cost model, not invented. Limits below are real and enforced server-side. Credits are administratively granted in this deployment; no payment can be taken."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p, i) => (
              <Reveal key={p.code} delay={(i % 4) * 70}>
                <div className="flex h-full flex-col border border-white/10 bg-card p-6 transition-colors hover:border-red-600/60">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">{p.name}</h3>
                    <span className="font-mono text-[11px] text-red-600">
                      {p.priceCents === null ? "PRICING PENDING" : `$${(p.priceCents / 100).toFixed(0)}/MO`}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{p.description}</p>
                  <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                    <div className="flex justify-between"><dt>Sessions</dt><dd className="text-white">{p.maxConcurrentSessions}</dd></div>
                    <div className="flex justify-between"><dt>Min / day</dt><dd className="text-white">{p.maxMinutesPerDay}</dd></div>
                    <div className="flex justify-between"><dt>Min / month</dt><dd className="text-white">{p.maxMinutesPerMonth}</dd></div>
                    <div className="flex justify-between"><dt>Upload slots</dt><dd className="text-white">{p.maxModelUploads}</dd></div>
                    <div className="flex justify-between"><dt>Tiers</dt><dd className="text-right text-white">{p.allowedTiers.join(", ")}</dd></div>
                  </dl>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== OPERATOR BRIEF (ADMIN ONLY) =============== */}
      {isAdmin ? (
        <section className="border-b border-white/10 bg-black" id="operator-brief">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <Reveal>
              <div className="border-2 border-dashed border-red-600/70 bg-red-950/10 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex h-9 w-9 items-center justify-center border border-red-600 bg-red-600/10">
                    <EyeOff className="h-4 w-4 text-red-600" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-lg font-bold uppercase tracking-widest text-white">Operator brief</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red-500">Restricted &mdash; administrator eyes only</p>
                  </div>
                  <Badge className="ml-auto border-red-600 bg-red-600 font-mono text-[10px] text-white hover:bg-red-600">ADMIN SESSION</Badge>
                </div>
                <p className="mt-4 max-w-3xl font-mono text-[11px] leading-relaxed text-zinc-400">
                  This section renders only for administrator sessions. Its content is served from an ADMIN-gated
                  endpoint and is never embedded in the public page bundle - signed-out users and regular users receive
                  HTTP 403, and the attempt is written to the security event log.
                </p>

                {briefError ? (
                  <p className="mt-6 border-l-2 border-red-600 bg-black p-3 font-mono text-xs text-red-400">{briefError}</p>
                ) : null}

                {!brief && !briefError ? (
                  <p className="mt-6 font-mono text-xs text-zinc-500">FETCHING OPERATOR BRIEF&hellip;</p>
                ) : null}

                {brief ? (
                  <div className="mt-8 space-y-10">
                    {/* live counters */}
                    <div>
                      <p className="label-kicker text-zinc-400">Live counters &middot; generated {new Date(brief.generatedAt).toLocaleTimeString()}</p>
                      <div className="mt-4 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-4 lg:grid-cols-6">
                        {[
                          ["USERS", brief.counts.users.total],
                          ["SUSPENDED", brief.counts.users.suspended],
                          ["PENDING REVIEW", brief.counts.models.pendingReview],
                          ["APPROVED MODELS", brief.counts.models.approved],
                          ["WORKERS", brief.counts.workers.total],
                          ["ACTIVE SESSIONS", brief.counts.sessions.active],
                          ["QUEUED", brief.counts.queue.waiting],
                          ["OPEN TICKETS", brief.counts.tickets.unresolved],
                          ["RATE-LIMITED 24H", brief.counts.security.rateLimited24h],
                          ["DENIED 24H", brief.counts.security.permissionDenied24h],
                          ["REQUESTS 24H", brief.counts.traffic.requests24h],
                          ["TAKEDOWNS", brief.counts.models.takenDown],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="bg-black p-4">
                            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
                            <p className="mt-1 font-display text-2xl font-bold text-white">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* env checklist */}
                    <div>
                      <p className="label-kicker text-zinc-400">Environment</p>
                      <div className="mt-4 grid gap-2 font-mono text-xs sm:grid-cols-2">
                        {[
                          ["ADMIN_EMAIL", brief.env.adminEmailSet],
                          ["ADMIN_PASSWORD", brief.env.adminPasswordSet],
                          ["GOOGLE OAUTH", brief.env.googleEnabled],
                          ["EMAIL_MODE", brief.env.emailMode],
                          ["APP_ORIGIN", brief.env.appOrigin],
                          ["CHUNK MS", String(brief.env.audioChunkMs)],
                        ].map(([k, v]) => (
                          <p key={String(k)} className="flex items-center justify-between border border-white/10 bg-black px-3 py-2">
                            <span className="text-zinc-500">{k}</span>
                            <span className={typeof v === "boolean" ? (v ? "text-white" : "text-red-500") : "text-white"}>
                              {typeof v === "boolean" ? (v ? "SET" : "NOT SET") : String(v).toUpperCase()}
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* internal write-ups */}
                    <div>
                      <p className="label-kicker text-zinc-400">Internal write-ups &middot; never shown to users</p>
                      <div className="mt-4 space-y-3">
                        {brief.notes.map((n, i) => (
                          <div key={n.id} className="border border-white/10 bg-black p-4">
                            <p className="font-display text-sm font-bold uppercase tracking-wide text-white">
                              <span className="mr-3 font-mono text-red-600">{String(i + 1).padStart(2, "0")}</span>
                              {n.title}
                            </p>
                            <p className="mt-2 pl-8 text-sm leading-relaxed text-zinc-400">{n.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ========================== FINAL CTA =========================== */}
      <section className="relative overflow-hidden bg-black">
        <div className="grid-lines grid-lines-fade absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/15 blur-[110px]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-28 text-center sm:px-6 sm:py-36">
          <Reveal>
            <p className="label-kicker text-red-600">Open the pipeline</p>
            <h2 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
              Try it with<br /><span className="text-red-600">your own voice.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Create an account, open the studio and speak. The latency numbers you will see are measured from your
              own session, chunk by chunk.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" className="glow-red-lg h-12 bg-red-600 px-10 font-display text-sm font-bold uppercase tracking-widest hover:bg-red-500" onClick={() => navigate(user ? "studio" : "auth/register")}>
                {user ? "Enter the studio" : "Create free account"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 border-white/30 bg-transparent px-8 font-display text-sm font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black" onClick={() => navigate("legal/voice-rights")}>
                Voice rights policy
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
