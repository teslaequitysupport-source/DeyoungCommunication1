"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VoxMark } from "@/components/app/app-shell";

// Step-by-step usage guides. Every instruction describes a real path that
// exists today: the browser studio, manual virtual-audio-cable routing into
// OBS / Discord / Zoom, recording + download, and the honest mobile state.
// Nothing here promises the phase 2 desktop companion; where a step is
// platform-specific, both platforms are named.

function Chip({ tone, children }: { tone: "ok" | "part" | "plan"; children: React.ReactNode }) {
  const styles =
    tone === "ok"
      ? "border-white/60 bg-white text-zinc-950"
      : tone === "part"
        ? "border-white/35 bg-transparent text-zinc-100"
        : "border-red-600/60 bg-red-950/40 text-red-300";
  return <Badge variant="outline" className={`font-mono text-[11px] tracking-wide ${styles}`}>{children}</Badge>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-12">
      <span aria-hidden className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border border-red-600/60 bg-red-950/40 font-display text-sm font-bold text-red-300">
        {n}
      </span>
      <h4 className="text-sm font-semibold text-zinc-100">
        <span className="sr-only">Step {n}: </span>{title}
      </h4>
      <div className="mt-1 space-y-1.5 text-sm leading-relaxed text-zinc-400">{children}</div>
    </li>
  );
}

function Guide({ id, title, status, children }: { id: string; title: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="border-t border-white/10 pt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id={`${id}-h`} className="font-display text-xl font-semibold tracking-tight text-white">{title}</h3>
        {status}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function GuidesView({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="bg-black">
      {/* Page head */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <p className="label-kicker text-red-500">Guides</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Every way to use VoxCore, step by step
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400">
            From your first converted sentence in the browser studio to routing the converted voice into OBS,
            Discord or Zoom. Each guide uses a path that exists today, and anything that needs extra software
            or a planned feature is labeled exactly that way. No step hides a surprise.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Chip tone="ok">Browser studio: supported today</Chip>
            <Chip tone="part">OBS, Discord, Zoom: manual cable routing today</Chip>
            <Chip tone="plan">Native apps: coming soon</Chip>
          </div>
          <nav aria-label="Guides on this page" className="mt-8 flex flex-wrap gap-2">
            {[
              ["guide-studio", "Start in the studio"],
              ["guide-obs", "OBS"],
              ["guide-social", "Discord, Zoom, Meet"],
              ["guide-record", "Record and download"],
              ["guide-mobile", "Phones and tablets"],
              ["guide-trouble", "Fixes"],
            ].map(([id, label]) => (
              <Button key={id} variant="outline" size="sm" className="h-9" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                {label}
              </Button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-14 px-4 py-14 sm:px-6">
        <figure>
          <img
            src="/img/stream-desk.png"
            alt="A dark streaming desk with a microphone on a boom arm, headphones and a monitor showing audio level meters, lit by red accent light"
            className="w-full rounded-[var(--radius)] border border-white/10 object-cover"
            loading="lazy"
          />
          <figcaption className="mt-2 text-xs text-zinc-500">
            Illustrative image, generated for this page. Your setup will look different; the routing principle is the same.
          </figcaption>
        </figure>

        <Guide id="guide-studio" title="Start in the studio" status={<Chip tone="ok">Supported today</Chip>}>
          <p>
            The studio runs in your browser. Nothing to install, and the converted audio never leaves your
            machine unless a conversion worker is serving your session.
          </p>
          <ol className="space-y-5">
            <Step n={1} title="Create your account and sign in">
              <p>Registration needs an email plus a password with at least 10 characters, an uppercase letter, a lowercase letter and a digit. Verify the email when the message arrives to unlock everything.</p>
            </Step>
            <Step n={2} title="Open the studio and pick a voice">
              <p>Voices marked DSP run on built-in signal processing and are always available. They shift pitch and formants, the two cues listeners use to read a voice as more masculine or more feminine.</p>
            </Step>
            <Step n={3} title="Allow the microphone">
              <p>Your browser asks for permission once. Audio is captured only while a session is running, and the on-screen level meter moves when the mic hears you.</p>
            </Step>
            <Step n={4} title="Speak and listen">
              <p>Wear headphones from now on. With speakers, your microphone re-hears the converted output and the result feeds back. The studio reports the latency it measures for your session; that number is the honest one for your hardware.</p>
            </Step>
            <Step n={5} title="Tune and save">
              <p>Adjust the voice parameters until it sounds right. Turn on session recording to keep the converted audio in your browser; it stays there until you download it (see the record and download guide).</p>
            </Step>
          </ol>
        </Guide>

        <Guide id="guide-obs" title="Use your converted voice in OBS" status={<Chip tone="part">Works today with a virtual cable</Chip>}>
          <p>
            OBS cannot talk to the studio directly today. The working path is a virtual audio cable: the
            browser plays the converted voice into a virtual device, and OBS records that device as if it were
            a microphone. The native desktop companion (planned) will replace this setup with a single virtual
            microphone, one install, no routing.
          </p>
          <div className="mt-4 border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
            <p className="font-medium text-zinc-100">What you need</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-400">
              <li>Windows: <strong>VB-CABLE</strong> (virtual audio device, donationware from vb-audio.com).</li>
              <li>macOS: <strong>BlackHole 2ch</strong> (free, from existential.audio).</li>
              <li>Headphones, so the microphone never hears the converted output.</li>
            </ul>
          </div>
          <ol className="mt-5 space-y-5">
            <Step n={1} title="Install the virtual cable">
              <p>Run the VB-CABLE installer (Windows) or the BlackHole installer (macOS), then restart the machine. You now have a playback device called CABLE Input (Windows) or BlackHole 2ch (macOS) and a matching recording device called CABLE Output or BlackHole 2ch.</p>
            </Step>
            <Step n={2} title="Send the studio's sound into the cable">
              <p>Windows: Settings, System, Sound, Volume mixer. Find your browser, set its output to CABLE Input. macOS: set the browser's output device to BlackHole 2ch from its own audio settings or via Audio MIDI Setup. The studio keeps working exactly as before; its sound now flows into the cable instead of your speakers.</p>
            </Step>
            <Step n={3} title="Add the cable as an OBS source">
              <p>In OBS: Sources, plus button, Audio Input Capture, create new, then pick CABLE Output (Windows) or BlackHole 2ch (macOS). Rename the source to something like VoxCore voice.</p>
            </Step>
            <Step n={4} title="Start a session and check the meters">
              <p>Open the studio, start a conversion session and speak. The OBS meter for VoxCore voice should move in sync with your speech. Keep your real microphone either muted in OBS or on a separate source you control with push-to-talk.</p>
            </Step>
            <Step n={5} title="Do a private test recording first">
              <p>Hit Start Recording in OBS, speak for thirty seconds, stop it, and play the file back. If the level is low, raise it in OBS via the source's filters (Gain). Measure the delay between your lips and the converted sound yourself and decide whether it fits your stream. No number is quoted here because it depends on your hardware.</p>
            </Step>
          </ol>
        </Guide>

        <Guide id="guide-social" title="Discord, Zoom and Google Meet" status={<Chip tone="part">Works today with a virtual cable</Chip>}>
          <p>
            Same principle as OBS: the apps listen for a microphone, so you hand them the cable that carries
            the converted voice instead. Every app below has a device picker in its voice or audio settings.
          </p>
          <ol className="space-y-5">
            <Step n={1} title="Route the studio into the cable">
              <p>Follow steps 1 and 2 of the OBS guide. The cable now carries your converted voice continuously while the session runs.</p>
            </Step>
            <Step n={2} title="Pick the cable as your microphone">
              <p>Discord: User Settings, Voice and video, Input device, CABLE Output (Windows) or BlackHole 2ch (macOS). Zoom: Settings, Audio, Microphone. Google Meet: Settings, Audio, Microphone, then pick the same device in the browser permission prompt if it appears.</p>
            </Step>
            <Step n={3} title="Turn off the automatic helpers">
              <p>Disable automatic gain control and noise suppression in the app for the cable device. Those helpers are tuned for human microphones and will pump or gate the converted voice.</p>
            </Step>
            <Step n={4} title="Quick sanity check before you join">
              <p>Discord and Zoom both have mic tests that play your input back. Speak, listen, adjust. Your friends hear the converted voice; you hear it through the headphones connected to the browser's other output, or directly in the studio's monitor.</p>
            </Step>
          </ol>
        </Guide>

        <Guide id="guide-record" title="Record and download" status={<Chip tone="ok">Supported today</Chip>}>
          <p>
            If you want a converted audio file rather than a live voice, the studio can record the converted
            output for you. The recording lives in your browser, not on the server, and you download it as a
            file you can drop into any editor, or use it as playback audio inside OBS with no cable at all.
          </p>
          <ol className="space-y-5">
            <Step n={1} title="Enable session recording in the studio">
              <p>Flip the recording switch before you start speaking. The indicator turns on while capture is live.</p>
            </Step>
            <Step n={2} title="Speak, stop, download">
              <p>When you end the session the recording is ready in the studio. Download it and it is yours; the platform does not keep a copy.</p>
            </Step>
            <Step n={3} title="Use the file anywhere">
              <p>Drag it into your editor, add it as a Media Source in OBS, or play it during a stream. This path has zero real-time constraints, so it suits produced content best.</p>
            </Step>
          </ol>
        </Guide>

        <Guide id="guide-mobile" title="Phones and tablets" status={<Chip tone="plan">Web works today, native apps coming soon</Chip>}>
          <p>
            The web studio works in modern mobile browsers: Android Chrome converts in-app today, and iOS
            Safari converts in-app too. What phones do not allow, by deliberate operating system design, is
            replacing the system microphone so every app on the phone hears the converted voice. Android 10+
            blocks unverified mic injection and iOS sandboxes the microphone entirely. We say this plainly
            instead of selling a workaround that breaks weekly.
          </p>
          <p>
            Native Android and iOS apps are in design. They will make in-app conversion clean and one tap, and
            they will still respect the OS boundaries above. You can join the notify list in the apps section
            on the home page; that list is used once, to tell you the app is out.
          </p>
        </Guide>

        <Guide id="guide-trouble" title="When something does not work" status={<Chip tone="ok">Checklist</Chip>}>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["OBS meters stay flat", "The cable directions point opposite ways: apps play into CABLE Input, recording devices listen on CABLE Output. Re-check step 2 and step 3; the most common mistake is picking the wrong end of the cable in one of them."],
              ["You hear yourself twice, or echo", "Something is monitoring the cable back to your speakers. Use headphones, and mute the cable device in your OS sound settings if your system loops it back."],
              ["The converted voice lags behind you", "That is real latency in the chain, and it grows with small buffers on weak hardware. Measure it in the studio, try a lighter DSP voice, and avoid Bluetooth headphones for live use; they add their own delay."],
              ["The browser never asks for mic access", "The permission was denied earlier. Click the lock icon in the address bar, reset the microphone permission for the site, then reload and allow it."],
              ["The level into Discord is tiny", "Raise the cable device level in your OS sound settings, and lift it further with OBS-style Gain in the app. Then turn the app's automatic gain control off, it fights the level."],
              ["Everything else breaks", "Signed in: open a ticket from the Support page, it lands in the staff inbox with your session data attached. Signed out: the contact form on the same page gets you a reference code by email."],
            ].map(([q, a]) => (
              <div key={q} className="border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-zinc-100">{q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{a}</p>
              </div>
            ))}
          </div>
        </Guide>

        {/* Bottom CTA */}
        <div className="border-t border-white/10 pt-10 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4">
            <VoxMark size={40} />
            <h3 className="font-display text-2xl font-bold tracking-tight text-white">Try it while you read</h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              The studio is free to try and runs in the browser you already have. Hearing your own voice come
              back as someone else takes about a minute to set up.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" className="h-12 bg-red-600 px-6 font-display font-bold uppercase tracking-wider hover:bg-red-500" onClick={() => navigate("studio")}>
                Open the studio
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6" onClick={() => navigate("auth/register")}>
                Create account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
