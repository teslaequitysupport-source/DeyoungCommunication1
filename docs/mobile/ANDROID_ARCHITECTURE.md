# Android Architecture (Design)

Checked: 2026-09-10. Not built.

## Audio stack
- Capture: AudioRecord (16 kHz PCM16, 128 ms frames) or Oboe for low
  latency; AAudio on 8.0+.
- Playback: AudioTrack/Oboe with a small jitter queue; underrun counters.
- Foreground service with type microphone for sustained capture;
  foreground-start restrictions on 12+ respected; audio focus handled.

## Networking
- OkHttp + socket.io-client (java/kotlin) to the same gateway protocol.
- TLS everywhere; the gateway token flow is identical to web.

## Constraints recorded honestly
- Background capture is restricted (Android 9+ background limits, 11+
  microphone-app-op); conversion sessions require the foreground service
  and a visible notification.
- Bluetooth SCO has added latency; USB audio is more reliable when present.
