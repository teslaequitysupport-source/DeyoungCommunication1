# Mobile Network Resilience (Design)

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
