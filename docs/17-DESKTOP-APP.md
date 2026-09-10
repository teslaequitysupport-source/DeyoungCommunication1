# Desktop App (Windows First)

Checked: 2026-09-10. Status: architecture documented; native shell not built
in this milestone. The web studio already covers in-browser use on any OS.

## Recommended shape
- Tauri (Rust) shell wrapping the same studio UI, with a native audio
  module; or a thin native tray app plus the browser studio.
- Account, device registration, session and voice selection reuse the same
  REST/session APIs as the web studio. No second backend.

## Audio I/O plan
- Capture: WASAPI shared mode via a Rust crate (cpal) or the browser stack
  inside the webview.
- Output: two paths. (a) monitor to the default output; (b) virtual
  microphone for other apps to consume (see 18-VIRTUAL-MICROPHONE.md).

## Virtual microphone routing (Mode B)
- The desktop app writes converted PCM into a virtual audio device; Discord,
  Zoom, OBS and friends select that device as a microphone.
- Driver reality: VB-CABLE is the pragmatic choice on Windows. It is
  donationware with a free license for personal use; commercial bundling
  requires an agreement with the author. Open-source alternatives exist
  (e.g., Scream, VirtualAudioCable-like projects) with varying maturity and
  signing status. Driver signing means the platform CANNOT silently install
  a virtual device; the app must guide installation and verify presence.

## Compatibility matrix (Windows 10/11)
| Target app | Status | Why |
|---|---|---|
| OBS (mic source = CABLE) | SUPPORTED (via virtual device) | standard WASAPI capture |
| Discord (input = CABLE) | SUPPORTED (via virtual device) | standard capture path |
| Zoom (input = CABLE) | SUPPORTED (via virtual device) | standard capture path |
| Browser Meet/Teams (input = CABLE) | PARTIAL | browser device pickers vary; user selects the device |
| System-wide mic replacement | UNSUPPORTED | Windows does not allow global mic swap without drivers per app |

Statuses are honest defaults from platform capabilities; per-app testing on
real hardware is still required before shipping claims. None of these are
tested in this environment, which has no Windows host or audio hardware.
