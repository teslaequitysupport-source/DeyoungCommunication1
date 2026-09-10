# Mobile Audio Pipeline (Design)

Checked: 2026-09-10.

- Frame size stays 128 ms / 16 kHz / PCM16 for protocol parity with web.
- Client-side pre-processing: platform AEC/AGC toggles; no custom DSP in
  v1 to keep latency and battery predictable.
- Jitter buffer: 2-3 frames initial, adaptive; underruns surfaced to the
  same stats surface as web (bufferUnderruns).
- Recording: converted output written to m4a/WAV in app documents; share
  sheet export. Same privacy stance: nothing uploaded unless the user says so.
