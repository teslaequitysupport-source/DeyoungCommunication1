# Worklog

---
Task ID: 1
Agent: main (Super Z)
Task: Read the ULTIMATE MASTER RESEARCH + BUILD DIRECTIVE (Real-Time AI Voice Platform) and perform the pre-implementation research gate.

Work Log:
- Read full directive: /home/z/my-project/upload/Pasted Content_1789035798090.txt (2877 lines, 84 sections)
- Directive Section 2 requires: initial research, then EXACTLY 3 high-value questions, then STOP until user answers.
- Ran web searches (saved in /home/z/my-project/research/): kaggle_tos.json, rvc_license.json, wokada_latency.json, svc_licenses.json, nigeria_payments.json, zerogpu.json

Stage Summary:
- Key verified findings (2026-09, date-checked):
  - RVC (RVC-Project/Retrieval-based-Voice-Conversion-WebUI): MIT licensed code; permissive license for source + pretrained base models (per annotated-RVC by gudgud96). Community ecosystem shares custom .pth voice models with UNKNOWN rights; voice rights of any third-party voice model must be verified per-model.
  - w-okada/voice-changer (VCClient): real-time VC client supporting RVC models, GPU acceleration, custom .pth import. RVC realtime reported ~90ms end-to-end with ASIO on local GPU.
  - Seed-VC: real-time support, ~300ms algorithmic delay + ~100ms device delay; reported as commercially usable license (exact license text to be verified in Phase 1 deep audit).
  - DDSP-SVC: open source singing VC, lighter weight, real-time capable.
  - Kaggle: GPU sessions capped (~9h/session, ~30h/week), interactive idle timeouts; NOT 24/7 infrastructure. ToS commercial-use restrictions for serving third-party traffic need verification in Phase 1 (flagged risk, do not assume allowed).
  - HuggingFace ZeroGPU: quota-based (PRO $9/mo = 8x quota, $1 per 10min above), not persistent workers, not free production infra.
  - Paystack: Nigeria-first, has official Subscriptions API + webhooks; Flutterwave also viable. Both are the credible launch rails for a Nigeria-based SaaS.
- Directive constraints accepted: no em dashes anywhere; no fabricated data/claims; scale-to-zero mandatory; provider abstraction; admin command centre separate from user dashboard; 60+ required docs in /docs, /agents, /prompts.
- Next: ask exactly 3 questions (platform priority, voice model policy, billing posture) and STOP.
