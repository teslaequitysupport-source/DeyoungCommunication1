"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge, Spinner } from "@/components/app/ui-bits";
import { apiGet, apiSend, CatalogModel } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { SiteConfig } from "@/components/app/app-shell";

// REAL-TIME STUDIO
//
// Audio path (all real): microphone -> AudioWorklet capture (128 ms chunks) ->
// socket.io (authenticated, XTransformPort gateway) -> audio gateway -> worker
// agent (DSP/RVC engine) -> gateway -> playback worklet ring buffer ->
// speakers. Latency is measured client-side per chunk (send -> receive of the
// same seq) and shown live as P50/P95. The same numbers are reported to the
// backend by the gateway for the session record.

interface SessionStart {
  status: "ASSIGNED" | "QUEUED" | "REJECTED";
  sessionId: string;
  workerId?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  queuePosition?: number;
  reason?: string;
}

interface LatStats {
  n: number;
  p50: number;
  p95: number;
  last: number;
  sent: number;
  recv: number;
  dropsPct: number;
  bufferUnderruns: number;
}

const CHUNK_SAMPLES = 2048; // 128 ms at 16 kHz
const SAMPLE_RATE = 16000;

function fmtMs(v: number) { return `${Math.round(v)} ms`; }

export default function StudioView({ navigate, refreshMe, config }: { navigate: (to: string) => void; refreshMe: () => Promise<void>; config: SiteConfig | null }) {
  const { toast } = useToast();
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [phase, setPhase] = useState<"IDLE" | "STARTING" | "QUEUED" | "LIVE" | "ENDING">("IDLE");
  const [queuePos, setQueuePos] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [micLevel, setMicLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState<LatStats>({ n: 0, p50: 0, p95: 0, last: 0, sent: 0, recv: 0, dropsPct: 0, bufferUnderruns: 0 });
  const [recording, setRecording] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureRef = useRef<AudioWorkletNode | null>(null);
  const playbackRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const seqRef = useRef(0);
  const pendingRef = useRef<Map<number, number>>(new Map());
  const statsRef = useRef<LatStats>({ n: 0, p50: 0, p95: 0, last: 0, sent: 0, recv: 0, dropsPct: 0, bufferUnderruns: 0 });
  const convertedRef = useRef<Float32Array[]>([]);
  const recordingRef = useRef(false);
  const sessionRowRef = useRef<{ start: number }>({ start: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    apiGet<{ models: CatalogModel[] }>("/api/models").then((d) => {
      setModels(d.models);
      if (d.models.length > 0) setModelId((cur) => cur || d.models[0].id);
    }).catch(() => {});
    navigator.mediaDevices?.enumerateDevices?.().then((all) => {
      setDevices(all.filter((d) => d.kind === "audioinput"));
    }).catch(() => {});
    // Unmount teardown: release external resources only. The full session-end
    // path (metrics reporting, state reset) runs through stopEverything, which
    // is bound to user actions, not to this effect's lifetime.
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { socketRef.current?.disconnect(); } catch { /* ignore */ }
      try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      try { void ctxRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

  const pushStat = (ms: number) => {
    const s = statsRef.current;
    s.n += 1;
    s.last = ms;
    s.recv += 1;
    // running p50/p95 over a 400-sample window (recompute cheaply each 10)
    (s as LatStats & { hist?: number[] }).hist = (s as LatStats & { hist?: number[] }).hist || [];
    const hist = (s as LatStats & { hist?: number[] }).hist!;
    hist.push(ms);
    if (hist.length > 400) hist.shift();
    const sorted = [...hist].sort((a, b) => a - b);
    s.p50 = sorted[Math.floor(sorted.length * 0.5)];
    s.p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    s.dropsPct = s.sent > 0 ? Math.max(0, Math.round(((s.sent - s.recv) / s.sent) * 1000) / 10) : 0;
    setStats({ ...s });
  };

  const onAudioOut = useCallback((msg: { seq: number; ts: number; audio: Uint8Array }) => {
    const sentAt = pendingRef.current.get(msg.seq);
    if (sentAt !== undefined) {
      pendingRef.current.delete(msg.seq);
      pushStat(Date.now() - sentAt);
    }
    const pcm16 = new Int16Array(msg.audio.buffer.slice(msg.audio.byteOffset, msg.audio.byteOffset + msg.audio.byteLength));
    const f32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;
    if (recordingRef.current) {
      convertedRef.current.push(f32.slice(0));
      if (convertedRef.current.length > 3000) convertedRef.current.splice(0, 500); // cap ~6 min
    }
    playbackRef.current?.port.postMessage({ type: "play", data: f32 });
     
  }, []);

  const start = async () => {
    setError(null);
    if (!modelId) {
      setError("Pick a voice first.");
      return;
    }
    setPhase("STARTING");
    try {
      const res = await apiSend<SessionStart>("/api/sessions", "POST", { modelId, requestedTier: "AUTO" });
      if (res.status === "REJECTED") {
        setError(reasonText(res.reason || "REJECTED"));
        setPhase("IDLE");
        return;
      }
      setSessionId(res.sessionId);
      sessionRowRef.current.start = Date.now();

      if (res.status === "QUEUED") {
        setQueuePos(res.queuePosition ?? null);
        setPhase("QUEUED");
        toast({ title: "No worker capacity right now", description: "You are in the queue. The fleet is designed to recover; try again shortly." });
        setPhase("IDLE");
        return;
      }

      // Audio graph
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
      ctxRef.current = ctx;
      await ctx.audioWorklet.addModule("/worklets/vox-worklet.js");

      const source = ctx.createMediaStreamSource(stream);
      const capture = new AudioWorkletNode(ctx, "vox-capture", { processorOptions: { chunkSamples: CHUNK_SAMPLES } });
      const playback = new AudioWorkletNode(ctx, "vox-playback");
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      capture.port.onmessage = (e) => {
        if (e.data?.type !== "chunk") return;
        const f32 = e.data.data as Float32Array;
        // level meter
        let peak = 0;
        for (let i = 0; i < f32.length; i += 8) peak = Math.max(peak, Math.abs(f32[i]));
        setMicLevel(peak);
        // convert to Int16 and send
        const pcm16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          const v = Math.max(-1, Math.min(1, f32[i]));
          pcm16[i] = Math.round(v * 32767);
        }
        const seq = ++seqRef.current;
        pendingRef.current.set(seq, Date.now());
        statsRef.current.sent += 1;
        socketRef.current?.emit("audio", { seq, data: pcm16.buffer });
      };
      playback.port.onmessage = (e) => {
        if (e.data?.type === "underrun") {
          statsRef.current.bufferUnderruns += 1;
        }
      };

      source.connect(capture);
      source.connect(analyser);
      playback.connect(ctx.destination);

      // Gateway socket
      const socket = io("/?XTransformPort=3003", {
        transports: ["websocket", "polling"],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10_000,
      });
      socketRef.current = socket;
      socket.on("connect", () => {
        socket.emit("auth", { token: res.gatewayToken }, (ack: { ok: boolean; error?: string }) => {
          if (!ack.ok) {
            setError(`Gateway rejected the session token: ${ack.error ?? "unknown"}`);
            void stopEverything(true);
          }
        });
      });
      socket.on("peer-ready", () => {
        setPhase("LIVE");
        toast({ title: "Session live", description: "Speak into your microphone. Converted audio returns through the worker." });
      });
      socket.on("peer-lost", () => {
        setError("The worker disconnected mid-session. The platform has recorded the failure; you can start again.");
        void stopEverything(true);
      });
      socket.on("audio-out", onAudioOut);
      socket.on("connect_error", () => {
        setError("Could not reach the audio gateway. It may not be running in this deployment.");
      });

      // meter animation loop
      const tick = () => {
        const analyser = analyserRef.current;
        if (analyser) {
          const arr = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteTimeDomainData(arr);
          let peak = 0;
          for (let i = 0; i < arr.length; i += 4) peak = Math.max(peak, Math.abs(arr[i] - 128) / 128);
          setMicLevel(peak);
        }
        if (ctxRef.current) setElapsed(Math.round((Date.now() - sessionRowRef.current.start) / 1000));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start the session");
      setPhase("IDLE");
    }
  };

  const stopEverything = async (abandon?: boolean) => {
    cancelAnimationFrame(rafRef.current);
    recordingRef.current = false;
    try { socketRef.current?.disconnect(); } catch {}
    try { captureRef.current?.disconnect(); } catch {}
    try { playbackRef.current?.disconnect(); } catch {}
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { await ctxRef.current?.close(); } catch {}
    socketRef.current = null;
    captureRef.current = null;
    playbackRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
    setMicLevel(0);
    const sid = sessionId;
    setPhase("IDLE");
    setElapsed(0);
    setStats({ n: 0, p50: 0, p95: 0, last: 0, sent: 0, recv: 0, dropsPct: 0, bufferUnderruns: 0 });
    if (sid && !abandon) {
      const s = statsRef.current;
      await apiSend(`/api/sessions/${sid}/metrics`, "POST", {
        p50Ms: s.p50 || 0, p95Ms: s.p95 || 0,
        packetsSent: s.sent, packetsReceived: s.recv, dropsPct: s.dropsPct,
      }).catch(() => {});
      await apiSend(`/api/sessions/${sid}/end`, "POST", {}).catch(() => {});
      await refreshMe();
    } else if (sid) {
      await apiSend(`/api/sessions/${sid}/end`, "POST", {}).catch(() => {});
    }
    setSessionId(null);
  };

  const toggleRecording = () => {
    if (!recording) {
      convertedRef.current = [];
      recordingRef.current = true;
      setRecording(true);
      toast({ title: "Recording converted output", description: "Recording will stop when you press stop." });
    } else {
      recordingRef.current = false;
      setRecording(false);
      const chunks = convertedRef.current;
      if (chunks.length > 0) {
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const pcm = new Float32Array(total);
        let off = 0;
        for (const c of chunks) { pcm.set(c, off); off += c.length; }
        const wav = encodeWav(pcm, SAMPLE_RATE);
        const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `voxcore-session-${sessionId ?? "audio"}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Recording saved", description: `${Math.round(total / SAMPLE_RATE)}s of converted audio as WAV.` });
      } else {
        toast({ title: "Nothing recorded yet" });
      }
    }
  };

  const model = models.find((m) => m.id === modelId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Real-time studio</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Microphone to converted playback through the live worker fleet. All latency figures below are measured from this session.
          </p>
        </div>
        <StatusBadge status={phase === "LIVE" ? "ACTIVE" : phase === "STARTING" ? "CONNECTING" : phase === "IDLE" ? "ENDED" : phase} />
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
            <CardDescription>Pick a voice, connect your microphone and go live. Processed audio plays back immediately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voice">Voice model</Label>
                <Select value={modelId} onValueChange={setModelId} disabled={phase !== "IDLE"}>
                  <SelectTrigger id="voice" aria-label="Voice model"><SelectValue placeholder="Choose a voice" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.engine})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {model ? (
                  <p className="text-xs text-zinc-500">{model.description}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="device">Microphone</Label>
                <Select value={deviceId} onValueChange={setDeviceId} disabled={phase !== "IDLE"}>
                  <SelectTrigger id="device" aria-label="Microphone device"><SelectValue placeholder="Default device" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Default device</SelectItem>
                    {devices.map((d, i) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {phase === "IDLE" ? (
                <Button className="bg-violet-600 hover:bg-violet-500" onClick={start} disabled={!modelId}>
                  Start session
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => stopEverything(false)} disabled={phase === "STARTING"}>
                  {phase === "STARTING" ? <Spinner /> : "End session"}
                </Button>
              )}
              <Button variant="outline" onClick={toggleRecording} disabled={phase !== "LIVE"}>
                {recording ? "Stop recording and save WAV" : "Record converted audio"}
              </Button>
              {phase === "LIVE" ? (
                <span className="font-mono text-xs text-zinc-500">live {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
              ) : null}
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-500">
                <span>Microphone level</span>
                <span>{phase === "LIVE" ? "capturing" : "idle"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, micLevel * 140)}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Measured latency</CardTitle>
            <CardDescription>Chunk round trip: capture to converted playback.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">P50</div>
                <div className="text-xl font-semibold tabular-nums">{stats.n ? fmtMs(stats.p50) : "-"}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="text-[10px] uppercase tracking-wider text-zinc-400">P95</div>
                <div className="text-xl font-semibold tabular-nums">{stats.n ? fmtMs(stats.p95) : "-"}</div>
              </div>
            </div>
            <dl className="space-y-1.5 text-xs text-zinc-500">
              <div className="flex justify-between"><dt>Chunks sent</dt><dd className="tabular-nums">{stats.sent}</dd></div>
              <div className="flex justify-between"><dt>Chunks received</dt><dd className="tabular-nums">{stats.recv}</dd></div>
              <div className="flex justify-between"><dt>Drop rate</dt><dd className="tabular-nums">{stats.sent ? `${stats.dropsPct}%` : "-"}</dd></div>
              <div className="flex justify-between"><dt>Playback underruns</dt><dd className="tabular-nums">{stats.bufferUnderruns}</dd></div>
            </dl>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              These numbers are computed in your browser from the same chunk stream the gateway measures. The session record in your dashboard stores the gateway-side percentiles.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-zinc-200 dark:border-zinc-800">
        <CardContent className="pt-4 text-xs leading-relaxed text-zinc-500">
          <p>
            <strong className="text-zinc-600 dark:text-zinc-300">Engine note.</strong> Built-in voices use the DSP engine (granular pitch and formant processing) and run on any worker, including CPU-only local workers.
            RVC community voices require a GPU worker with that model loaded; the scheduler will queue or reject honestly rather than fake the result. Neural-tier quality and latency depend on the operator-provisioned worker; the platform reports only measured numbers.
          </p>
          <p className="mt-2">
            Browser compatibility: Chrome and Edge ship the full AudioWorklet feature set used here; Firefox works with occasional device-specific quirks. iOS Safari supports capture but backgrounding suspends the audio context.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function reasonText(code: string): string {
  switch (code) {
    case "NO_ACTIVE_PLAN": return "No active plan on your account. Contact support.";
    case "TIER_NOT_IN_PLAN": return "GPU-tier conversion is not part of your current plan.";
    case "CONCURRENT_LIMIT": return "You already have the maximum concurrent sessions for your plan.";
    case "RATE_LIMITED": return "Too many session starts in a short window. Wait a moment.";
    case "MODEL_UNAVAILABLE": return "That voice is no longer available.";
    case "STUDIO_DISABLED": return "The studio is temporarily disabled by an administrator.";
    default: return `Session rejected (${code}).`;
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
