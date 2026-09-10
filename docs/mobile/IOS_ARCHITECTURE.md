# iOS Architecture (Design)

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
