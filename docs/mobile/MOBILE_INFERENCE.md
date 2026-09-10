# Mobile On-Device Inference (Design Notes)

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
