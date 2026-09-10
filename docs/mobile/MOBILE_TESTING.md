# Mobile Testing Plan (Design)

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
