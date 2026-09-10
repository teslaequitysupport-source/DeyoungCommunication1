# Networking

Checked: 2026-09-10.

## Ports
- 3000: Next.js control plane (HTTP + API). Dev: bun run dev.
- 3003: audio gateway (socket.io over HTTP/WebSocket). Path "/".
- Workers: outbound only. No inbound ports on worker hosts.

## Transport choices
- Control plane: plain HTTP(S) request/response; cookie sessions for users,
  bearer persist tokens for workers, signed short JWTs for gateway roles.
- Audio: socket.io (WebSocket first, polling fallback). Chosen because it
  works from browsers and from dial-out notebooks with identical code,
  survives proxies that kill idle TCP (heartbeats), and reconnection is
  built in on the client side. WebRTC is documented as a future transport
  for peer-grade jitter handling; it is not implemented here and is not
  claimed.
- NAT traversal: not needed for the outbound-only worker model. TURN/STUN
  enter the design only if WebRTC peering is added later.

## Latency instrumentation
- The gateway timestamps every client chunk and matches worker responses by
  seq to produce per-chunk RTT; P50/P95 go to the control plane at session
  end. The browser measures its own P50/P95 independently and displays it.

## Failure handling
- socket.io client reconnection (studio) with attempt cap; agent reconnects
  by ending the session loop (the scheduler re-queues demand).
- Gateway pair inactivity sweep: 120 s.
- Engine.io ping/pong: 15 s interval, 30 s timeout (gateway default tuned).

## Measured reference (loopback, 2026-09-10)
- Gateway chunk RTT P50 3 ms, P95 6 ms; agent conversion ~0.2 ms per chunk;
  end-to-end browser numbers are deployment specific and are measured in
  the studio, not advertised here.
