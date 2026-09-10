# VOXCORE - Vision

Checked: 2026-09-10. No em dashes anywhere in this documentation set.

VOXCORE is a real-time AI voice conversion platform. A user selects a voice,
speaks into a microphone, and converted audio returns with minimal latency,
routed to whatever output the user chooses. The same account works from a
browser today, and the architecture leaves room for Windows, Android and iOS
clients without a rebuild.

The product has three defining commitments:

1. REAL, NOT FAKED. Every feature that claims to work does work: real worker
   processes register and heartbeat, real audio streams through the gateway,
   real converted audio returns, real usage is metered server side. Where a
   capability is not yet real (for example RVC model inference when no RVC
   runtime is installed), the system says so instead of pretending.
2. FREE FIRST. The platform starts on free capacity: a local CPU worker and
   assisted free GPU notebooks. Paid capacity exists in the architecture but
   scales to zero when unused. The scheduler prefers free workers and treats
   paid capacity as a guarded exception with budgets.
3. HONEST LIMITS. Compatibility claims carry a status: SUPPORTED, PARTIAL,
   UNSUPPORTED, WORKAROUND, or DESKTOP COMPANION REQUIRED. Anything unverified
   is marked unverified. Legal compliance is marked as requiring professional
   review where it does.

The end state: a premium real-time voice platform with an operator command
centre, a resilient multi-provider worker fleet, scale-to-zero economics, and
a clear licensing and voice-rights posture that a real business could stand on.
