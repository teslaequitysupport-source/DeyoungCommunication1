# Virtual Microphone

Checked: 2026-09-10.

## Windows
- VB-CABLE (donationware): installs a virtual playback+capture pair. Our app
  plays converted audio into CABLE Input; other apps capture CABLE Output.
  License: free for personal use; redistribution/bundling needs author
  agreement. Signing: driver is signed by the author; installation needs
  admin rights. The platform does not bundle or silently install it.
- Open-source alternatives: Scream (virtual sound card, more oriented to
  audio streaming), VB-Audio alternatives, VirtualAudioCable (paid).
  None are bundled in this milestone; all require the same install-and-
  verify flow.

## Android
- Global mic replacement is not permitted to normal apps. In-app conversion
  (Mode A) is the primary path. Feeding other apps requires either OEM
  features or root, which is out of scope; documented as UNSUPPORTED
  without root.

## iOS
- System-wide microphone replacement is not permitted. In-app conversion
  only; audio unit extensions exist for host apps that integrate them.
  Documented honestly as UNSUPPORTED for third-party app injection.

## Verification plan (when a Windows host is available)
1. Install VB-CABLE; confirm devices appear.
2. Play a test tone into CABLE Input; capture from CABLE Output in
   Audacity; measure latency and drift.
3. Repeat with Discord, Zoom, OBS; record results in this matrix with dates.
Until that run happens, the matrix rows above stay labelled as
platform-capability defaults, not tested claims.
