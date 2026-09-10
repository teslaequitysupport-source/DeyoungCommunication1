# License Audit (Code and Dependencies)

Checked: 2026-09-10. Runtime deps: see package.json files; audit method:
read each package's declared license at lock time and re-check before any
commercial launch.

## First-party code
- This repository: proprietary to its owner until a license is chosen.
  No third-party code was pasted in.

## Key third-party components
| Component | License | SaaS use | Notes |
|---|---|---|---|
| Next.js, React | MIT | yes | standard |
| Prisma | Apache-2.0 | yes | standard |
| socket.io, socket.io-client | MIT | yes | gateway + clients |
| Tailwind CSS, shadcn/ui primitives (Radix) | MIT | yes | radix MIT |
| zod | MIT | yes | validation |
| bcryptjs | MIT/BSD-style | yes | password hashing |
| python-socketio, requests, psutil, numpy (worker) | MIT/BSD/Apache family | yes | verify exact pins at freeze |
| Bun, Node.js runtimes | MIT-ish permissive | yes | runtime only |

## Rules
- Nocopyleft build-time or runtime dependency entered the default pipeline
  (GPL components are isolated or excluded; see 25).
- Fonts: system font stack; no external font CDN (privacy and license).
- Icons: inline/lucide (ISC/MIT family) only.
- Re-audit before each release; record the date here.
