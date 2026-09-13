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
import { Smartphone, Apple } from "lucide-react";

// Mobile apps section: an honest "coming soon" with design previews, plus a
// working waitlist (one email when the app ships, nothing else; the live
// count comes from the real database, never a marketing number).

function LevelBars() {
  return (
    <div aria-hidden className="flex h-8 items-end justify-center gap-1">
      {[10, 18, 26, 32, 26, 18, 10, 22, 30, 20, 12].map((h, i) => (
        <span key={i} className="w-1.5 rounded-full bg-red-600/80" style={{ height: h }} />
      ))}
    </div>
  );
}

function PhoneMock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[240px]">
      <div className="rounded-[36px] border border-white/15 bg-black p-2 shadow-vox">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d12]">
          {/* Notch */}
          <div className="relative flex h-7 items-center justify-center border-b border-white/5" aria-hidden>
            <span className="absolute top-1.5 h-4 w-20 rounded-full bg-black" />
          </div>
          <div className="p-3">{children}</div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-zinc-500">{label}</p>
    </div>
  );
}

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
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* Copy + waitlist */}
          <div>
            <p className="label-kicker text-red-600">Coming soon</p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl">
              The studio, in<br />your pocket.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-[1.7] text-zinc-400">
              Native Android and iOS apps are in design now. The layout you see below is the actual direction:
              pick a voice, hold to speak, watch the level. The web studio already works in modern mobile
              browsers today; the apps make it one tap and add background audio.
            </p>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-zinc-500">
              Design preview, not screenshots of a finished app. One honest boundary does not change on mobile:
              Android and iOS do not let any app replace the system microphone, so conversion happens inside
              the app, exactly like the web studio.
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

          {/* Phone previews */}
          <div className="grid grid-cols-2 items-start gap-6 sm:gap-8" role="img" aria-label="Two design previews of the planned mobile app: the studio screen with a hold to speak button and level bars, and the voices list screen">
            <PhoneMock label="Studio: hold to speak">
              <div aria-hidden>
                <div className="flex items-center gap-2">
                  <VoxMark size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">VoxCore</span>
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-600 live-dot" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Bright", "Warm", "Airy"].map((v, i) => (
                    <span key={v} className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${i === 0 ? "border-red-600 bg-red-950/50 text-white" : "border-white/15 text-zinc-400"}`}>{v}</span>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between text-[9px] text-zinc-500">
                    <span>CHUNK LATENCY</span>
                    <span className="font-mono">measured live</span>
                  </div>
                  <div className="mt-2"><LevelBars /></div>
                </div>
                <div className="mt-3 grid h-20 place-items-center rounded-full border-2 border-red-600 bg-red-600/15">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Hold to speak</span>
                </div>
              </div>
            </PhoneMock>

            <PhoneMock label="Voices: pick and convert">
              <div aria-hidden className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-3 w-3 text-zinc-500" />
                  <Apple className="h-3 w-3 text-zinc-500" />
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500">design preview</span>
                </div>
                {[
                  ["Bright", "DSP", "female-leaning"],
                  ["Deep", "DSP", "male-leaning"],
                  ["Warm", "DSP", "neutral"],
                  ["Your upload", "RVC", "pending review"],
                ].map(([name, kind, note]) => (
                  <div key={name} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-200">{name}</span>
                      <span className="border border-white/20 px-1 py-px font-mono text-[8px] text-zinc-400">{kind}</span>
                    </div>
                    <span className="mt-0.5 block text-[9px] text-zinc-500">{note}</span>
                  </div>
                ))}
              </div>
            </PhoneMock>
          </div>
        </div>
      </div>
    </section>
  );
}
