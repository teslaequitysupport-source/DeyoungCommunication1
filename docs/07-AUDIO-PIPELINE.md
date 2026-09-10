# Audio Pipeline

Checked: 2026-09-10.

## Capture (browser)
- getUserMedia with echoCancellation and noiseSuppression configurable;
  AudioWorklet (public/worklets/capture-worklet.js) buffers 128 ms frames
  at 16 kHz and posts Float32 chunks.
- The studio converts to Int16 PCM and gates sending on peer-ready; seq
  numbers are dense from the moment streaming starts.

## Transport
- socket.io over WebSocket (polling fallback) to the gateway. Chunks are
  small (2048 samples = 4096 bytes); JSON envelope with a binary field.
- Backpressure: not a media server; slow consumers see queue growth in the
  pending map and the client sees rising RTT. Dropped pre-peer frames are
  explicitly acked false instead of vanishing.

## Conversion (worker)
- DSP engine (real, always available):
  - granular_pitch_shift: overlap-add grain resampling, grain 1024,
    hop 256, cross-faded; pitchSemitones from model params.
  - tilt_formant: frequency-domain tilt around a pivot frequency to nudge
    formant balance; factor from model params.
  - Per-chunk infer measured ~0.17-0.21 ms on this machine (2026-09-10).
- RVC engine (conditional): used only when an RVC runtime and a model file
  are actually installed on the worker. Without them, RVC tier requests are
  rejected honestly (WORKER_CANNOT_SERVE_TIER), never faked.

## Playback (browser)
- playback-worklet.js maintains a small jitter queue; underruns are counted
  and surfaced in the studio stats as bufferUnderruns.
- Recording: converted chunks are accumulated and written to a 16-bit WAV
  blob in the browser when the user arms recording.

## Latency accounting (measured, loopback, 2026-09-10)
- Gateway chunk RTT P50 3 ms, P95 6 ms (30/30 chunks, no loss).
- The number the product advertises is per-deployment measurement, never a
  global claim. The studio shows live P50/P95 for the current session.
