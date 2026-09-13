"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/app/ui-bits";
import { apiGet, apiSend, ApiClientError } from "@/lib/client/api";
import { validateFields, emailHint } from "@/lib/client/form-validate";
import { waitlistJoinSchema } from "@/lib/validate";
import { VoxMark } from "@/components/app/app-shell";
import { cn } from "@/lib/utils";

// Mobile apps section: an honest "coming soon" with full-fidelity device
// previews, official-style store badges (clearly marked coming soon, never
// pretending the apps are downloadable), plus a working waitlist. The live
// count comes from the real database, never a marketing number.

/* ------------------------------ device chrome ----------------------------- */

// Layered neutral shadows (no color gradients) produce the titanium edge:
// outer ambient drop, bright top bevel, dark bottom falloff, thin rim light.
const FRAME_SHADOW =
  "0 0 0 1px rgba(255,255,255,0.10), inset 0 0 0 1.5px rgba(255,255,255,0.16), " +
  "inset 0 2px 1.5px rgba(255,255,255,0.28), inset 0 -3px 4px rgba(0,0,0,0.85), " +
  "0 28px 56px -18px rgba(0,0,0,0.72), 0 70px 110px -40px rgba(0,0,0,0.8)";

function SideButton({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute w-[3px] rounded-l-[2px] bg-[#2a2a31]", className)}
      style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(0,0,0,0.7), 1px 0 2px rgba(0,0,0,0.5)" }}
    />
  );
}

function StatusIcons() {
  return (
    <span className="flex items-center gap-1.5 text-white" aria-hidden>
      {/* cellular bars */}
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
        <rect x="0" y="7" width="2.6" height="4" rx="0.8" />
        <rect x="4" y="4.5" width="2.6" height="6.5" rx="0.8" />
        <rect x="8" y="2" width="2.6" height="9" rx="0.8" />
        <rect x="12" y="0" width="2.6" height="11" rx="0.8" />
      </svg>
      {/* wifi */}
      <svg width="14" height="11" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M2.5 6.5a15 15 0 0 1 19 0" />
        <path d="M6 10.5a10 10 0 0 1 12 0" />
        <path d="M9.5 14.2a5 5 0 0 1 5 0" />
        <circle cx="12" cy="16.6" r="0.8" fill="currentColor" stroke="none" />
      </svg>
      {/* battery */}
      <svg width="22" height="11" viewBox="0 0 25 12" fill="none">
        <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" strokeOpacity="0.5" />
        <rect x="2" y="2" width="15" height="8" rx="1.6" fill="currentColor" />
        <path d="M23.5 4v4a2.2 2.2 0 0 0 0-4z" fill="currentColor" fillOpacity="0.5" />
      </svg>
    </span>
  );
}

// Full-fidelity device preview: machined frame, buttons, Dynamic Island,
// status bar, screen glare and home indicator around authentic app UI.
// The content is a design preview of the real app direction, labeled as such.
function DevicePhone({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[250px]", className)}>
      <div className="relative">
        <div className="relative rounded-[52px] bg-[#1a1a20] p-[11px]" style={{ boxShadow: FRAME_SHADOW }}>
          {/* hardware buttons */}
          <SideButton className="-left-[3px] top-[110px] h-8" />
          <SideButton className="-left-[3px] top-[156px] h-12" />
          <SideButton className="-left-[3px] top-[214px] h-12" />
          <SideButton className="-right-[3px] top-[168px] h-16 rounded-l-[2px] rounded-r-[2px]" />
          {/* screen */}
          <div className="relative overflow-hidden rounded-[42px] border border-black bg-[#0a0a0d]">
            <div className="relative flex h-11 items-center justify-between px-6 pt-2" aria-hidden>
              <span className="text-[11px] font-semibold tracking-wide text-white">9:41</span>
              {/* Dynamic Island */}
              <span className="absolute left-1/2 top-1.5 flex h-[26px] w-[92px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2.5" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}>
                <span className="h-[9px] w-[9px] rounded-full bg-[#101016]" style={{ boxShadow: "inset 0 0 2px 1px rgba(80,90,120,0.55), 0 0 0 1.5px #000" }} />
              </span>
              <StatusIcons />
            </div>
            <div className="px-3.5 pb-7 pt-1">{children}</div>
            {/* home indicator */}
            <span aria-hidden className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-white/25" />
            {/* glass glare: a single soft reflection across the top-left */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[42px]"
              style={{ background: "linear-gradient(118deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.025) 16%, transparent 30%)" }}
            />
          </div>
        </div>
        {/* floor shadow grounds the device on the page */}
        <span
          aria-hidden
          className="absolute -bottom-7 left-1/2 -z-10 h-8 w-[86%] -translate-x-1/2 rounded-full bg-black/80 blur-xl"
        />
      </div>
      <p className="mt-9 text-center text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</p>
    </div>
  );
}

/* -------------------------------- app screens ------------------------------ */

function LevelBars() {
  return (
    <div aria-hidden className="flex h-9 items-end justify-center gap-1">
      {[10, 18, 26, 32, 26, 18, 10, 22, 30, 20, 12].map((h, i) => (
        <span
          key={i}
          className="level-bar w-1.5 rounded-full bg-red-600/85"
          style={{ height: h, animationDelay: `${i * 0.11}s` }}
        />
      ))}
    </div>
  );
}

function StudioScreen() {
  return (
    <div aria-hidden className="text-left">
      <div className="flex items-center gap-1.5 px-1">
        <VoxMark size={15} />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-200">VoxCore</span>
        <span className="live-dot ml-auto inline-block h-1.5 w-1.5 rounded-full bg-red-600" />
      </div>

      <div className="mt-3 rounded-[var(--radius)] border border-white/10 bg-white/[0.03] p-2.5">
        <p className="text-[8px] font-medium uppercase tracking-[0.18em] text-zinc-500">Session</p>
        <div className="mt-1.5 flex items-center justify-between rounded-[var(--radius-sm)] border border-white/12 bg-black px-2 py-1.5">
          <span className="text-[10px] font-semibold text-zinc-100">Bright</span>
          <span className="border border-white/20 px-1 py-px font-mono text-[7px] uppercase tracking-widest text-zinc-400">DSP</span>
        </div>
        <div className="mt-1.5 grid h-7 place-items-center rounded-[var(--radius-sm)] bg-red-600 font-display text-[9px] font-bold uppercase tracking-[0.16em] text-white">
          Start session
        </div>
      </div>

      <div className="mt-2 rounded-[var(--radius)] border border-white/10 bg-white/[0.03] p-2.5">
        <div className="flex items-center justify-between text-[8px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          <span>Measured latency</span>
          <span className="font-mono normal-case tracking-normal text-zinc-400">live, this session</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-zinc-400">
          <span>P50 <span className="text-zinc-200">-</span></span>
          <span>P95 <span className="text-zinc-200">-</span></span>
        </div>
        <div className="mt-2"><LevelBars /></div>
      </div>

      <div className="mt-3 grid h-[72px] w-[72px] place-items-center justify-self-center rounded-full border-2 border-red-600 bg-red-600/15" style={{ boxShadow: "0 0 0 6px rgba(225,29,46,0.08), 0 8px 24px -6px rgba(225,29,46,0.45)" }}>
        <span className="px-1 text-center text-[8px] font-bold uppercase leading-[1.3] tracking-[0.14em] text-red-400">Hold to<br />speak</span>
      </div>
    </div>
  );
}

const VOICE_ROWS: [string, string, string][] = [
  ["Bright", "DSP", "female-leaning"],
  ["Warm", "DSP", "neutral"],
  ["Deep", "DSP", "male-leaning"],
  ["Your upload", "RVC", "pending review"],
];

function VoicesScreen() {
  return (
    <div aria-hidden className="text-left">
      <div className="flex items-center justify-between px-1">
        <span className="font-display text-[13px] font-bold tracking-[-0.01em] text-white">Voices</span>
        <span className="font-mono text-[9px] text-zinc-500">3 built-in + yours</span>
      </div>
      <div className="mt-2 flex h-7 items-center rounded-full border border-white/12 bg-white/[0.03] px-2.5 text-[9px] text-zinc-500">
        Search voices
      </div>
      <div className="mt-2 space-y-1.5">
        {VOICE_ROWS.map(([name, kind, note], i) => (
          <div key={name} className={cn("rounded-[var(--radius-sm)] border p-2", i === 0 ? "border-red-600/70 bg-red-950/30" : "border-white/10 bg-white/[0.03]")}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-zinc-100">{name}</span>
              <span className="border border-white/20 px-1 py-px font-mono text-[7px] uppercase tracking-widest text-zinc-400">{kind}</span>
            </div>
            <span className="mt-0.5 block text-[8px] text-zinc-500">{note}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-around rounded-t-[var(--radius)] border-t border-white/10 px-2 pt-2 text-[8px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        <span>Studio</span>
        <span className="text-red-500">Voices</span>
        <span>Account</span>
      </div>
    </div>
  );
}

/* ------------------------------- store badges ------------------------------ */

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function PlayLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor" aria-hidden>
      <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
    </svg>
  );
}

// Store badges in the official visual format, honestly marked as coming
// soon: they are not links to a live store listing, because no listing
// exists yet. Activating one scrolls to the waitlist form.
function StoreBadge({ store, onActivate }: { store: "apple" | "google"; onActivate: () => void }) {
  const apple = store === "apple";
  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        "group flex h-[60px] min-w-[186px] flex-1 items-center gap-3.5 rounded-[var(--radius)] border border-white/20 bg-black px-5 text-left outline-none transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-white/50 focus-visible:ring-2 focus-visible:ring-ring",
      )}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 28px -12px rgba(0,0,0,0.8)" }}
      aria-label={apple ? "VoxCore for iPhone: coming soon. Jump to the notify list." : "VoxCore for Android: coming soon. Jump to the notify list."}
    >
      {apple ? <AppleLogo /> : <PlayLogo />}
      <span className="leading-tight">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Coming soon on</span>
        <span className="mt-0.5 block font-display text-[17px] font-bold tracking-[-0.01em] text-white transition-colors group-hover:text-white">
          {apple ? "App Store" : "Google Play"}
        </span>
      </span>
    </button>
  );
}

/* --------------------------------- section --------------------------------- */

export default function AppsSection() {
  const [count, setCount] = useState<number | null>(null);
  const [countState, setCountState] = useState<"loading" | "ready" | "error">("loading");
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<"ANDROID" | "IOS" | "ANY">("ANY");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<{ count: number }>("/api/waitlist")
      .then((d) => { if (alive) { setCount(d.count); setCountState("ready"); } })
      .catch(() => { if (alive) setCountState("error"); });
    return () => { alive = false; };
  }, []);

  const focusWaitlist = () => {
    document.getElementById("wl-email")?.focus({ preventScroll: true });
    document.getElementById("wl-email")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const website = String(new FormData(e.currentTarget).get("website") || "");
    const values = { email, platform, website };

    const result = validateFields(waitlistJoinSchema, values);
    if (!result.ok) {
      setError(result.errors.email ?? result.errors.form ?? "Check the highlighted field.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await apiSend<{ ok: boolean; count: number }>("/api/waitlist", "POST", values);
      setJoined(res.count);
      setCount(res.count);
      setCountState("ready");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not join. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="apps" className="border-b border-white/10 bg-black">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* Copy + badges + waitlist */}
          <div>
            <p className="label-kicker text-red-600">Coming soon</p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl">
              The studio, in<br />your pocket.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-[1.7] text-zinc-400">
              Native Android and iOS apps are in active development. The previews on the right are the actual app
              design: pick a voice, start a session, hold to speak, watch the measured level. The web studio already
              works in modern mobile browsers today; the apps make it one tap and add background audio.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <StoreBadge store="apple" onActivate={focusWaitlist} />
              <StoreBadge store="google" onActivate={focusWaitlist} />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Neither store has a live listing yet. These badges take you to the notify list below, nothing else.
            </p>

            <div className="mt-8 max-w-lg border border-white/10 bg-white/[0.03] p-5">
              {joined !== null ? (
                <div role="status">
                  <p className="font-display text-base font-bold text-white">You are on the list.</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                    One email when the app ships, then we delete your address unless you ask us to keep it.
                    Nothing else will ever be sent. {joined > 1 ? `${joined} people are waiting now.` : "You are the first."}
                  </p>
                </div>
              ) : (
                <>
                  <p className="font-display text-base font-bold text-white">Tell me when it ships</p>
                  <form onSubmit={submit} noValidate className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="wl-email">Email</Label>
                      <Input
                        id="wl-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="h-12"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(emailHint(e.target.value) ?? ""); }}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "wl-error" : "wl-purpose"}
                      />
                      <p id="wl-purpose" className="text-xs text-zinc-500">Used once, to announce the app. No newsletter, no sharing.</p>
                    </div>
                    <fieldset>
                      <legend className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Your phone</legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {([["ANDROID", "Android"], ["IOS", "iPhone"], ["ANY", "Both"]] as const).map(([v, label]) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setPlatform(v)}
                            aria-pressed={platform === v}
                            className={`min-h-11 rounded-[var(--radius-sm)] border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                              platform === v ? "border-red-600 bg-red-950/50 text-white" : "border-white/20 text-zinc-300 hover:border-white/40"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {/* Honeypot: must stay empty. */}
                    <div className="hidden" aria-hidden="true">
                      <Label htmlFor="wl-website">Website</Label>
                      <Input id="wl-website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                    </div>
                    {error ? <p id="wl-error" role="alert" className="text-xs text-red-400">{error}</p> : null}
                    <Button type="submit" className="h-12 w-full bg-red-600 font-display font-bold uppercase tracking-wider hover:bg-red-500 sm:w-auto sm:px-8" disabled={busy}>
                      Notify me
                    </Button>
                  </form>
                </>
              )}
            </div>

            <p className="mt-4 text-xs text-zinc-500" aria-live="polite">
              {countState === "loading" ? (
                <Skeleton className="h-3 w-40" aria-label="Loading waitlist count" />
              ) : countState === "error" ? (
                "The live counter is unavailable right now; the form still works."
              ) : count === 0 ? (
                "You would be the first on the list."
              ) : (
                `${count} ${count === 1 ? "person is" : "people are"} on the list right now. The counter is the real database number.`
              )}
            </p>
          </div>

          {/* Device previews */}
          <div>
            <div className="relative" role="img" aria-label="Two full-fidelity design previews of the planned mobile app on realistic phone frames: the studio screen with a voice selector, measured latency panel and hold to speak button, and the voices list screen with built-in DSP voices and an upload pending review">
              <span aria-hidden className="absolute -bottom-4 left-1/2 -z-10 h-44 w-[78%] -translate-x-1/2 rounded-full bg-red-600/10 blur-[100px]" />
              <div className="relative grid grid-cols-2 items-start gap-5 sm:gap-9">
                <DevicePhone label="Studio">
                  <StudioScreen />
                </DevicePhone>
                <DevicePhone label="Voices" className="sm:mt-12">
                  <VoicesScreen />
                </DevicePhone>
              </div>
            </div>
            <p className="mx-auto mt-10 max-w-md text-center text-xs leading-relaxed text-zinc-500">
              Rendered design previews of the app in development, not store screenshots. One honest boundary does not
              change on mobile: Android and iOS do not let any app replace the system microphone, so conversion
              happens inside the app, exactly like the web studio.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
