"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiGet, CatalogModel, Me, PlanInfo, ApiClientError } from "@/lib/client/api";
import { SiteConfig } from "@/components/app/app-shell";
import Vox3D from "@/components/app/vox-3d";
import { TiltCard, Reveal, Skeleton, SkeletonCards, SkeletonStats, EmptyState } from "@/components/app/ui-bits";
import AppsSection from "@/components/app/apps-section";
import {
  AudioWaveform, ServerCog, ShieldCheck, UploadCloud, Gauge,
  ArrowRight, ChevronDown, EyeOff, Scale, ScanEye, FileLock2, DatabaseZap,
} from "lucide-react";

// The homepage: a full-length product surface in strict black / white / one
// red. Copy follows the honest-engineering rules: no invented metrics, no
// testimonials, no fake logos. What is not shipped is labeled, not advertised.
// Motion budget: ONE hero moment (the voiceform sphere + kinetic headline);
// everything else is subtle orientation (reveals, scroll progress).

const COMPAT_MATRIX = [
  { target: "Browser apps (this studio)", status: "SUPPORTED", note: "Chrome, Edge, Firefox: microphone capture and converted playback in-browser, measured live in the studio." },
  { target: "Discord / OBS / Zoom (Windows)", status: "DESKTOP COMPANION", note: "Direct routing needs the Windows companion (planned). A manual virtual-audio-cable path works today; the walkthrough lives in the Guides page." },
  { target: "Third-party apps (Android)", status: "PARTIAL", note: "Android 10+ restricts unverified microphone injection. In-app conversion works; system-wide routing does not." },
  { target: "Third-party apps (iOS)", status: "UNSUPPORTED", note: "iOS sandboxing does not permit replacing the system microphone. In-app conversion only." },
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

// Objection handling: every answer states the truth, including the limits.
const FAQ = [
  {
    q: "Is the conversion actually real-time?",
    a: "For built-in DSP voices, yes: audio is processed in 128 ms chunks and returned while you speak, with the P50/P95 latency of your own session shown live in the studio. RVC model inference runs on GPU workers that are burst-only in this deployment, so GPU-voice latency is not yet comparable and is never presented as real-time.",
  },
  {
    q: "Can I use it in Discord, OBS or Zoom?",
    a: "Two different answers, both honest. Direct system-wide routing needs the Windows desktop companion with a virtual microphone, and that is planned, not shipped. What works today is manual routing: a free virtual audio cable carries the studio's converted output into OBS, Discord or Zoom as an ordinary microphone. The Guides page walks through every click, including the latency tradeoffs you should measure yourself.",
  },
  {
    q: "Who can upload voices, and how are they reviewed?",
    a: "Anyone with an account can upload an RVC model, but every upload carries a mandatory rights attestation and license metadata, is fingerprinted (sha256) for dedup, and is published only after a human moderator approves it. Reports trigger immediate, audited takedown.",
  },
  {
    q: "What does it cost?",
    a: "Nothing is charged in this deployment, and that is stated plainly: the credit ledger and usage metering are live, but no payment provider is wired and prices stay unpublished until they are set from measured GPU cost data. Free-tier capacity is enforced server-side.",
  },
  {
    q: "What happens to my voice data?",
    a: "Microphone audio is captured in your browser, chunked, and processed in memory. Nothing is recorded to disk; your session telemetry (latency percentiles, packet stats) is stored so the numbers you see are real. You can end a session at any time and delete your account from the account page.",
  },
  {
    q: "Is there a mobile app?",
    a: "Not yet. Native Android and iOS apps are in design, and the web studio already works in modern mobile browsers. A phone cannot legally replace the system microphone for other apps, so in-app conversion is the honest shape of the mobile product. You can join the notify list in the apps section below; it is used exactly once.",
  },
  {
    q: "Why are some numbers on this page replaced with dashes?",
    a: "Because the deployment has not measured them yet. Counters on this page are fetched live from the running system, and nothing is pre-filled to look busier than it is. If a value is missing, the system does not have it.",
  },
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
  recentErrors?: { at: string; route: string; method: string; message: string; stack: string | null }[];
  recentClientFaults?: { createdAt: string; digest: string | null; message: string; route: string | null; page: string | null; buildSha: string | null }[];
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
      <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl">{title}</h2>
      {lede ? <p className="mt-4 max-w-3xl text-base leading-[1.7] text-zinc-400">{lede}</p> : null}
    </Reveal>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "SUPPORTED") return <Badge className="border-white bg-white text-[10px] font-medium tracking-wide text-black hover:bg-white">{status}</Badge>;
  if (status === "UNSUPPORTED") return <Badge className="border-red-500 bg-red-600 text-[10px] font-medium tracking-wide text-white hover:bg-red-600">{status}</Badge>;
  return <Badge className="border-white/40 bg-transparent text-[10px] font-medium tracking-wide text-zinc-200 hover:bg-transparent">{status}</Badge>;
}

export default function LandingView({ navigate, config, user }: { navigate: (to: string) => void; config: SiteConfig | null; user: Me["user"] }) {
  const [models, setModels] = useState<CatalogModel[] | null>(null);
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);
  const [limits, setLimits] = useState<LimitsResponse | null>(null);
  const [brief, setBrief] = useState<OperatorBrief | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    apiGet<{ models: CatalogModel[] }>("/api/models").then((d) => setModels(d.models)).catch(() => setModels([]));
    apiGet<{ plans: PlanInfo[] }>("/api/billing/plans").then((d) => setPlans(d.plans)).catch(() => setPlans([]));
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
        <Vox3D className="pointer-events-none absolute inset-0" intensity={config?.animationIntensity} />

        <div className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <div className="flex items-center gap-3">
            <span className="live-dot inline-block h-2 w-2 rounded-full bg-red-600" aria-hidden />
            <p className="label-kicker text-zinc-300">Real-time voice conversion &middot; infrastructure core &middot; live</p>
          </div>

          <h1 className="mt-8 font-display text-[13vw] font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-7xl lg:text-8xl">
            <span className="kinetic" style={{ animationDelay: "0.05s" }}>Your voice,</span>
            <span className="kinetic block text-red-600" style={{ animationDelay: "0.18s" }}>rebuilt</span>
            <span className="kinetic block" style={{ animationDelay: "0.31s" }}>in real time.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-pretty text-base leading-[1.7] text-zinc-400 sm:text-lg">
            VoxCore turns your microphone into a live voice pipeline: speak, and a converted voice comes back while you
            are still talking - carried by a self-healing worker fleet, an honest scheduler and a scale-to-zero cost
            model. Built for creators, developers and teams who need live voice, not offline renders. Every latency
            figure you will see is measured from real sessions, not marketed.
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

          <p className="mt-6 max-w-2xl text-[11px] font-medium uppercase leading-relaxed tracking-wide text-zinc-400">
            Registration requires email verification. This deployment has SMTP disabled, so verification tokens are
            shown once at signup (documented dev-mode behavior).
          </p>

          {/* Live honest counters - only numbers this deployment actually serves. */}
          <div className="mt-10 grid max-w-3xl grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-4">
            {[
              { label: "Enforced rate rules", value: limits ? String(limits.rules.length) : null },
              { label: "Voices published", value: models ? String(models.length) : null },
              { label: "Plans enforced", value: plans ? String(plans.length) : null },
              { label: "Fabricated metrics", value: "0" },
            ].map((s) => (
              <div key={s.label} className="bg-black px-4 py-4">
                {s.value !== null ? (
                  <p className="font-display text-2xl font-bold text-white">{s.value}</p>
                ) : (
                  <div className="skeleton h-7 w-10" />
                )}
                <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Pipeline strip */}
          <div className="mt-16 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-6">
            {["Microphone", "Capture 16 kHz", "Audio gateway", "Worker fleet", "Conversion", "Playback"].map((step, i) => (
              <div key={step} className="relative bg-black px-4 py-4 transition-colors hover:bg-red-950/30">
                <span className="text-[10px] font-medium text-red-600">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-300">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================== MANIFESTO =========================== */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <Reveal>
            <p className="label-kicker text-red-600">Principle 01: no fabrication</p>
            <p className="mt-8 max-w-5xl font-display text-3xl font-medium leading-[1.15] tracking-[-0.02em] text-white sm:text-5xl">
              Every number here is <span className="text-red-600">measured</span> from real sessions. Every capability
              is labeled <span className="font-medium">SUPPORTED</span>,{" "}
              <span className="font-medium">PARTIAL</span> or{" "}
              <span className="font-medium">UNSUPPORTED</span>. What is not shipped is{" "}
              <span className="text-hollow">not advertised.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ====================== PROBLEM / TENSION ======================= */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="The problem"
            title={<>Live voice is a<br />latency war.</>}
            lede="Offline voice conversion is a solved convenience. Real-time is a different discipline entirely: past roughly 150 ms of round-trip delay, conversation stops feeling natural and people talk over each other. Pipelines drop. Workers vanish mid-session. GPU bills explode overnight."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Delay kills conversation",
                b: "Humans interrupt within ~200 ms. A conversion pipeline that queues whole files can never join a live conversation - it has to think in small chunks, every chunk on a deadline.",
              },
              {
                n: "02",
                t: "Workers die mid-session",
                b: "Any fleet loses machines. If your session is pinned to one worker and that worker disappears, the silence is the product failing. Failover has to be automatic, not an apology email.",
              },
              {
                n: "03",
                t: "Capacity burns money",
                b: "GPUs idle between sessions cost real money every hour. Capacity nobody pays for must scale to zero, and paid capacity must be capped by explicit budgets - not by surprises.",
              },
            ].map((item, i) => (
              <Reveal key={item.n} delay={i * 90}>
                <div className="h-full border border-white/10 bg-card p-6 transition-colors hover:border-white/25">
                  <span className="text-sm font-semibold text-red-600">{item.n}</span>
                  <h3 className="mt-4 font-display text-lg font-bold tracking-[-0.01em] text-white">{item.t}</h3>
                  <p className="mt-3 text-sm leading-[1.7] text-zinc-400">{item.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= TRANSFORMATION ========================= */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="The transformation"
            title={<>One microphone.<br />A different voice.</>}
            lede="The most requested conversion: you speak with your own voice, and a different voice comes out. The built-in DSP voices get there by shifting pitch and formants in 128 ms chunks, the two acoustic cues listeners use to read a voice as masculine or feminine."
          />
          <div className="mt-14 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
            <Reveal>
              <figure className="group relative overflow-hidden rounded-[var(--radius)] border border-white/10">
                <img src="/img/man-mic.png" alt="A man speaking into a studio microphone, lit by red rim light" className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" loading="lazy" />
                <figcaption className="absolute bottom-0 left-0 right-0 bg-black/70 px-4 py-2 text-xs font-medium uppercase tracking-widest text-zinc-300 backdrop-blur">
                  Your microphone
                </figcaption>
              </figure>
            </Reveal>
            <div className="flex flex-col items-center gap-3 py-2 md:py-0" aria-hidden>
              <span className="hidden h-px w-16 bg-red-600 md:block" />
              <span className="grid h-12 w-12 place-items-center rounded-full border border-red-600 bg-red-950/50 text-red-500">
                <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-red-500">converted</span>
              <span className="hidden h-px w-16 bg-red-600 md:block" />
            </div>
            <Reveal delay={120}>
              <figure className="group relative overflow-hidden rounded-[var(--radius)] border border-white/10">
                <img src="/img/woman-mic.png" alt="A woman speaking into a studio microphone, lit by red rim light" className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" loading="lazy" />
                <figcaption className="absolute bottom-0 left-0 right-0 bg-black/70 px-4 py-2 text-xs font-medium uppercase tracking-widest text-zinc-300 backdrop-blur">
                  The converted output
                </figcaption>
              </figure>
            </Reveal>
          </div>
          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-zinc-500">
            Illustrative imagery, generated for this page. It represents a male voice being converted to a
            female-sounding voice, which is what the pitch and formant engines do; it is not a screenshot of one
            specific model. Open the studio, pick a built-in voice, and the result and latency you see there are
            measured from your own session. Voices beyond the built-in DSP set depend on approved models in the
            catalog.
          </p>
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
                  <div className="h-full border border-white/10 bg-card p-6 transition-colors duration-300 group-hover:border-red-600/60 group-hover:glow-red">
                    <div className="flex items-start justify-between">
                      <f.icon className="h-6 w-6 text-red-600" aria-hidden />
                      <span className="text-xs font-medium text-zinc-500 transition-colors group-hover:text-red-600">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="mt-6 font-display text-lg font-bold tracking-[-0.01em] text-white">{f.title}</h3>
                    <p className="mt-3 text-sm leading-[1.7] text-zinc-400">{f.body}</p>
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
                  <h3 className="font-display text-base font-bold tracking-[-0.01em] text-white sm:text-lg">{step.name}</h3>
                  <p className="col-start-2 text-sm leading-[1.7] text-zinc-400 sm:col-start-3">{step.body}</p>
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
            <div aria-label="Loading live rate limits" className="mt-14 grid grid-cols-2 gap-px border border-white/10 bg-white/10 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} aria-hidden className="bg-black p-5">
                  <div className="skeleton h-2.5 w-24" />
                  <div className="skeleton mt-3 h-7 w-16" />
                </div>
              ))}
            </div>
          )}
          {limits ? (
            <div className="mt-6 grid gap-2 text-[11px] leading-relaxed text-zinc-400 md:grid-cols-2">
              <p className="border-l-2 border-red-600 pl-3 uppercase tracking-wide">Enforcement: {limits.enforcement}</p>
              <p className="border-l-2 border-white/20 pl-3 uppercase tracking-wide">Abuse: {limits.abuse}</p>
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
            {models === null ? (
              <SkeletonCards count={4} className="sm:col-span-2 lg:col-span-4" />
            ) : (
              <>
                {models.slice(0, 4).map((m, i) => (
                  <Reveal key={m.id} delay={(i % 4) * 70}>
                    <TiltCard max={5}>
                      <div className="h-full border border-white/10 bg-card p-5 transition-colors hover:border-red-600/60">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-base font-bold tracking-[-0.01em] text-white">{m.name}</h3>
                          <Badge className="border-red-800 bg-red-950/70 text-[10px] font-medium text-red-400 hover:bg-red-950/70">{m.engine}</Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-[1.7] text-zinc-400">{m.description}</p>
                        <p className="mt-4 border-t border-white/10 pt-3 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          {m.licenseName}{m.licenseVerified ? " · verified" : " · unverified"}
                        </p>
                      </div>
                    </TiltCard>
                  </Reveal>
                ))}
                {models.length === 0 ? (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <EmptyState title="No approved models published yet" body="Built-in DSP voices are available in the studio now. Community RVC uploads appear here only after passing human moderation with a verified license." />
                  </div>
                ) : null}
              </>
            )}
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
              {/* Mobile: the table scrolls inside its own frame; the page never scrolls sideways. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-white/5 text-left">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-[11px] font-medium uppercase tracking-widest text-zinc-400">Target</th>
                      <th scope="col" className="px-4 py-3 text-[11px] font-medium uppercase tracking-widest text-zinc-400">Status</th>
                      <th scope="col" className="px-4 py-3 text-[11px] font-medium uppercase tracking-widest text-zinc-400">Why</th>
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
                  <h3 className="mt-6 font-display text-base font-bold tracking-[-0.01em] text-white">{g.title}</h3>
                  <p className="mt-3 text-sm leading-[1.7] text-zinc-400">{g.body}</p>
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
            {plans === null ? (
              <SkeletonCards count={4} className="sm:col-span-2 lg:col-span-4" />
            ) : (
              plans.map((p, i) => (
                <Reveal key={p.code} delay={(i % 4) * 70}>
                  <div className="flex h-full flex-col border border-white/10 bg-card p-6 transition-colors hover:border-red-600/60">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display text-lg font-bold tracking-[-0.01em] text-white">{p.name}</h3>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-red-600">
                        {p.priceCents === null ? "Pricing pending" : `$${(p.priceCents / 100).toFixed(0)}/mo`}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-[1.7] text-zinc-400">{p.description}</p>
                    <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      <div className="flex justify-between"><dt>Sessions</dt><dd className="text-white">{p.maxConcurrentSessions}</dd></div>
                      <div className="flex justify-between"><dt>Min / day</dt><dd className="text-white">{p.maxMinutesPerDay}</dd></div>
                      <div className="flex justify-between"><dt>Min / month</dt><dd className="text-white">{p.maxMinutesPerMonth}</dd></div>
                      <div className="flex justify-between"><dt>Upload slots</dt><dd className="text-white">{p.maxModelUploads}</dd></div>
                      <div className="flex justify-between"><dt>Tiers</dt><dd className="text-right text-white">{p.allowedTiers.join(", ")}</dd></div>
                    </dl>
                  </div>
                </Reveal>
              ))
            )}
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
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red-500">Restricted &middot; administrator eyes only</p>
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
                  <div className="mt-8" aria-label="Loading operator brief">
                    <SkeletonStats count={6} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
                    <div className="mt-6 space-y-3" aria-hidden>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="border border-white/10 bg-black p-4">
                          <div className="skeleton h-3.5 w-64" />
                          <div className="mt-3 space-y-2">
                            <div className="skeleton h-3 w-full" />
                            <div className="skeleton h-3 w-4/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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

                    {/* 500 diagnostics: what failed, where, with stack. */}
                    {brief.recentErrors && brief.recentErrors.length > 0 ? (
                      <div>
                        <p className="label-kicker text-red-500">Unhandled route errors &middot; in-process capture &middot; cleared on redeploy</p>
                        <p className="mt-2 font-mono text-[11px] text-zinc-500">
                          THE “INTERNAL SERVER ERROR” TOASTS USERS SEE LAND HERE WITH ROUTE + STACK. THIS IS THE DIAGNOSIS SOURCE.
                        </p>
                        <div className="mt-4 space-y-3">
                          {brief.recentErrors.map((e, i) => (
                            <div key={`${e.at}-${i}`} className="border border-red-900/60 bg-red-950/20 p-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <Badge className="border-red-600 bg-red-600 font-mono text-[10px] text-white hover:bg-red-600">500</Badge>
                                <p className="font-mono text-xs text-white">{e.method} {e.route}</p>
                                <p className="ml-auto font-mono text-[10px] text-zinc-500">{new Date(e.at).toLocaleString()}</p>
                              </div>
                              <p className="mt-2 font-mono text-[11px] leading-relaxed text-red-300">{e.message}</p>
                              {e.stack ? (
                                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap border-t border-red-900/40 pt-2 font-mono text-[10px] leading-relaxed text-zinc-500">{e.stack}</pre>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="label-kicker text-zinc-400">Unhandled route errors</p>
                        <p className="mt-3 border border-white/10 bg-black px-3 py-2 font-mono text-xs text-zinc-400">
                          NONE CAPTURED SINCE LAST DEPLOY. IF A USER REPORTS “INTERNAL SERVER ERROR”, THIS BLOCK SHOWS THE EXACT ROUTE AND STACK.
                        </p>
                      </div>
                    )}

                    {/* browser self-reported UI faults: what the visitor's
                        browser threw, on which route and build. Survives
                        redeploys, unlike the in-process ring above. */}
                    {brief.recentClientFaults && brief.recentClientFaults.length > 0 ? (
                      <div>
                        <p className="label-kicker text-red-500">Client UI faults &middot; last 24h &middot; self-reported by visitor browsers</p>
                        <div className="mt-4 space-y-3">
                          {brief.recentClientFaults.map((e, i) => (
                            <div key={`${e.createdAt}-${i}`} className="border border-red-900/60 bg-red-950/20 p-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <Badge className="border-red-600 bg-red-600 font-mono text-[10px] text-white hover:bg-red-600">UI</Badge>
                                <p className="font-mono text-xs text-white">{e.route ? `#/${e.route}` : (e.page ?? "/")}</p>
                                {e.buildSha ? <p className="font-mono text-[10px] text-zinc-500">build {e.buildSha.slice(0, 8)}</p> : null}
                                <p className="ml-auto font-mono text-[10px] text-zinc-500">{new Date(e.createdAt).toLocaleString()}</p>
                              </div>
                              <p className="mt-2 font-mono text-[11px] leading-relaxed text-red-300">{e.message}</p>
                              {e.digest ? (
                                <p className="mt-1 font-mono text-[10px] text-zinc-500">digest: {e.digest}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

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

      {/* ============================ FAQ =============================== */}
      <section className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHead
            kicker="Straight answers"
            title="Questions, handled honestly"
            lede="Every answer below describes the system as it is deployed right now - including what it cannot do."
          />
          <div className="mt-14 border-t border-white/10">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-white/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 transition-colors hover:text-red-400 [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-base font-bold tracking-[-0.01em] text-white sm:text-lg">{item.q}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 text-zinc-300 transition-transform duration-300 group-open:rotate-45 group-open:border-red-600 group-open:text-red-600" aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </span>
                </summary>
                <p className="max-w-3xl pb-6 text-sm leading-[1.7] text-zinc-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <AppsSection />

      {/* ========================== FINAL CTA =========================== */}
      <section className="relative overflow-hidden bg-black">
        <div className="grid-lines grid-lines-fade absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <p className="label-kicker text-red-600">Open the pipeline</p>
            <h2 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.02] tracking-[-0.02em] text-white sm:text-6xl">
              Try it with<br /><span className="text-red-600">your own voice.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-[1.7] text-zinc-400">
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
            <div className="mt-6">
              <Button variant="ghost" className="h-11 text-zinc-400 hover:text-white" onClick={() => navigate("guides")}>
                New here? Read the step-by-step guides first <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
