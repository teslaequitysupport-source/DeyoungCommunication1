#!/usr/bin/env python3
# VOXCORE docs batch 5: the mobile set (11 docs). Honest: architecture is
# documented; native clients are NOT built in this milestone.
import os

D = "/home/z/my-project/docs"
docs = {}

docs["mobile/MOBILE_ARCHITECTURE.md"] = """# Mobile Architecture

Checked: 2026-09-10. Status: DESIGN, not built. No mobile capability is
claimed as working.

## Modes
- MODE A In-app conversion: the app captures mic audio, streams to the
  platform, plays converted audio in-app. Feasible on both platforms.
- MODE B System/third-party routing: feeding other apps. On Android not
  possible for normal apps; on iOS not possible. Documented UNSUPPORTED.
- MODE C External audio routing: capture from files or other sources and
  convert; share results out. Feasible.

## Shape
- Thin native shells (Kotlin; Swift) reusing the same REST and gateway
  protocols. No second backend.
- The phone is always a CLIENT. Inference happens in the cloud fleet by
  default; local on-device inference is a documented option with hard
  limits (see MOBILE_INFERENCE).

## Why cloud-first on mobile
- Battery and thermal budgets on phones make sustained neural inference
  hostile; the fleet exists for exactly this. The client adapts to network
  quality and degrades honestly (see MOBILE_NETWORKING).
"""

docs["mobile/ANDROID_ARCHITECTURE.md"] = """# Android Architecture (Design)

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
"""

docs["mobile/IOS_ARCHITECTURE.md"] = """# iOS Architecture (Design)

Checked: 2026-09-10. Not built.

## Audio stack
- AVAudioEngine input tap at 16 kHz; convert to PCM16; 128 ms frames.
- AVAudioSession: playAndRecord category, voiceChat mode options measured
  at runtime; Voice Processing I/O toggle affects AEC/AGC and must be
  configurable per session.
- Background audio requires the audio background mode; long-lived mic use
  in background is limited; CallKit/PushKit are for real calls and are not
  a loophole for VoIP-less mic access.

## Networking
- URLSession WebSocket or a socket.io Swift client to the same protocol.

## Constraints recorded honestly
- System-wide mic replacement: NOT PERMITTED by iOS. Mode B is
  UNSUPPORTED; only in-app conversion (Mode A) and file flows (Mode C).
- ReplayKit broadcast captures screen audio, not arbitrary mic injection
  into other apps; not a workaround we claim.
"""

docs["mobile/MOBILE_AUDIO.md"] = """# Mobile Audio Pipeline (Design)

Checked: 2026-09-10.

- Frame size stays 128 ms / 16 kHz / PCM16 for protocol parity with web.
- Client-side pre-processing: platform AEC/AGC toggles; no custom DSP in
  v1 to keep latency and battery predictable.
- Jitter buffer: 2-3 frames initial, adaptive; underruns surfaced to the
  same stats surface as web (bufferUnderruns).
- Recording: converted output written to m4a/WAV in app documents; share
  sheet export. Same privacy stance: nothing uploaded unless the user says so.
"""

docs["mobile/MOBILE_NETWORKING.md"] = """# Mobile Network Resilience (Design)

Checked: 2026-09-10.

## Handled cases
- Wi-Fi to cellular and back: socket.io reconnection with backoff; a new
  session is started after transport loss (no silent resume, honest usage).
- Packet loss and jitter: RTT and drop stats from the gateway are displayed;
  the client increases buffer targets when drop% rises.
- Sleep/wake and backgrounding: on return, the session is re-established
  or the user is told it ended; no fake live state.
- NAT changes: covered by reconnect (new connection, new pairing).

## Honest gaps
- Seamless mid-session path migration (multipath TCP) is not planned for
  v1; a visible reconnect is the behaviour.
"""

docs["mobile/MOBILE_INFERENCE.md"] = """# Mobile On-Device Inference (Design Notes)

Checked: 2026-09-10.

- The DSP engine (granular pitch shift + tilt) could run on-device cheaply
  (it is ~0.2 ms per chunk on this desktop CPU); it is the honest local
  option and requires no model weights.
- Neural voice conversion on-device (Core ML / NNAPI / ONNX Runtime Mobile)
  is NOT assumed: RVC-class models are heavy for sustained mobile use;
  latency, thermal and battery would need real benchmarking on target
  devices before any claim. Until such benchmarks exist the platform
  states: cloud inference is the default; on-device neural inference is
  research, not a feature.
"""

docs["mobile/MOBILE_COMPATIBILITY.md"] = """# Mobile Compatibility Matrix

Checked: 2026-09-10. Statuses follow the directive's vocabulary. NOTHING
here has been tested on a device yet; these are platform-capability
statements, not claims.

| Capability | Android | iOS |
|---|---|---|
| In-app conversion (Mode A) | SUPPORTED (design) | SUPPORTED (design) |
| File/source conversion (Mode C) | SUPPORTED (design) | SUPPORTED (design) |
| Inject mic into other apps | UNSUPPORTED (normal apps) | UNSUPPORTED |
| System-wide virtual mic | UNSUPPORTED | UNSUPPORTED |
| Bluetooth mic capture | PARTIAL (SCO latency) | PARTIAL (SCO/HFP quirks) |
| USB audio | PARTIAL (device dependent) | PARTIAL (adapter dependent) |
| Background long sessions | PARTIAL (foreground service required) | PARTIAL (bg modes limited) |
| On-device neural VC | UNSUPPORTED (unbenchmarked) | UNSUPPORTED (unbenchmarked) |
"""

docs["mobile/MOBILE_BATTERY.md"] = """# Mobile Battery and Thermal (Design)

Checked: 2026-09-10.

- Streaming keeps the radio hot; expect measurable drain. The design keeps
  the phone a thin client precisely to avoid sustained neural compute.
- Quality/performance modes: frame batching (256 ms frames) halves overhead
  at a latency cost; exposed as a user setting with honest labels.
- Thermal: on warnings, drop to larger frames or pause; never claim
  unrestricted sustained capture.
- No battery numbers are claimed here; they get measured on devices.
"""

docs["mobile/MOBILE_SECURITY.md"] = """# Mobile Security (Design)

Checked: 2026-09-10.

- Tokens: the same short-lived gateway tokens; refresh via re-auth only.
- Storage: session tokens in the platform keystore/keychain; nothing in
  plaintext prefs.
- Transport: TLS with certificate pinning considered for release builds.
- Attestation: Play Integrity / App attestation evaluated at launch; not
  assumed to be unspoofable; server-side rate limits remain the backstop.
- Logging: no audio, no tokens in logs; crash reports scrubbed.
"""

docs["mobile/MOBILE_PRIVACY.md"] = """# Mobile Privacy (Design)

Checked: 2026-09-10.

- Mic permission: requested at first live session with a plain-language
  purpose string; no permission, no capture.
- No analytics SDKs; no ad identifiers; no third-party trackers in the app.
- Recordings stay on device until the user exports them.
- The same data minimisation and export/delete rights as web apply.
- Platform privacy nutrition labels: filled from this inventory at launch.
"""

docs["mobile/MOBILE_TESTING.md"] = """# Mobile Testing Plan (Design)

Checked: 2026-09-10.

## Device matrix (planned)
- Android: 10, 12, 13, 14 across a Samsung, a Pixel, a Xiaomi (OEM audio
  quirks), low-end 2 GB device included.
- iOS: 16, 17, 18 across an SE-class small screen, a standard iPhone, one
  with Bluetooth and one with USB audio accessories.

## Test classes
- Mode A live session: 10 minutes sustained; measure battery, thermal,
  underruns, RTT P50/P95.
- Network: Wi-Fi to cellular transitions, airplane-mode recovery, packet
  loss injection (throttled proxy).
- Permission denial paths; background/foreground transitions mid-session.
- App review compliance: mic purpose strings, background mode justification.

Nothing in this plan has been executed; results will be recorded here with
dates when devices are available.
"""

for name, content in docs.items():
    path = os.path.join(D, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
print("wrote mobile docs")
