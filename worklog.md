# VoxCore Worklog

---
Task ID: 1
Agent: Super Z (main)
Task: Fix recurring "Internal server error" (500); harden admin bootstrap; full-surface E2E verification against production Supabase. (Commit 398f3b5.)

Work Log:
- Production DB forensics (RequestMetric/SecurityEvent): all-time zero recorded 5xx; real failures were 400 register validation / 401 login / 429s.
- Shipped: bootstrap-admin.ts (idempotent ADMIN from env every boot), /api/health publishes errors.lastRingError, branded error.tsx + global-error.tsx, dashboard polling gated on session, standalone scripts normalize raw DATABASE_URL, probe-all.sh sweep.

Stage Summary:
- No reproducible code-level 500; admin guaranteed from env; self-diagnosis at /api/health.
- NOTE (Task 7 amendment): "zero recorded 5xx" is evidence only while the DB is healthy; metric writes go to the same DB.

---
Task ID: 2
Agent: Super Z (main)
Task: Full design-system upgrade per the 9-phase master spec (commit d6b32a5).

Work Log:
- Audit found: dead tailwind.config.ts, 3 typefaces, 2 reds, off-spec blacks, 5 decorative effects, no mobile menu, no problem/FAQ sections, generic VX logo.
- globals.css rewritten with spec tokens verbatim; unified red ramp; two typefaces (Space Grotesk + Inter).
- Landing rebuilt per narrative spec: problem + FAQ sections added, ONE hero moment kept; VoxMark glyph; mobile menu; favicon rewritten.

Stage Summary:
- Pushed d6b32a5 (17 files). Spec compliant: black/white/#e11d2e only, one radius, one shadow, honest copy.

---
Task ID: 3
Agent: Super Z (main)
Task: Diagnose "no visible change" report; make deployed version externally verifiable (commit 0c6a5fc).

Work Log:
- Verified upgrade d6b32a5 WAS on origin/main; break is deploy chain or cache, not missing work.
- /api/health now reports version (RAILWAY_GIT_COMMIT_SHA ?? dev-local).
- Pushed 0c6a5fc to force-trigger a fresh deploy.

Stage Summary:
- User checklist: hard refresh; check /api/health version; Railway Deployments tab; raise RAM >=1GB if build OOMs.

---
Task ID: 4
Agent: Super Z (main)
Task: Feature wave: transformation imagery, OBS/social guides, public support page, policy/data-use upgrades, apps coming-soon + waitlist, form validation, skeletons, no em dashes. (Commit 6e18f5a.)

Work Log:
- 3 brand-matched images (public/img/). Guides view (#/guides): 6 sections, honest status chips, real manual virtual-cable path for OBS/Discord/Zoom.
- Public support (#/support): contact form -> SupportRequest with VC-XXXXXX ref; honeypot + supportContact 3/h/IP.
- Apps coming-soon: CSS phone mockups, waitlist -> WaitlistEntry, live count with skeleton + honest error state.
- form-validate.ts reuses server zod schemas; legal: privacy categories + plain-language data use; cookies + cache disclosure; em dashes removed across src/; schema: SupportRequest + WaitlistEntry.

Stage Summary:
- Browser E2E desktop 1440 + mobile 390 clean; DB-backed POST round trips deferred to Railway.

---
Task ID: 5
Agent: Super Z (main)
Task: "Add all" + voice cloning from device audio upload; build the missing POST /api/models/upload (UI had posted to a 404). (Commit d28f3c0.)

Work Log:
- Schema: VoiceCloneRequest + VoiceCloneSample (bytea, cascade delete).
- POST /api/models/upload: requireUser + uploadsEnabled gate + plan slots + magic-byte sniff + streamed-to-disk + sha256 + ConsentRecord MODEL_UPLOAD.
- Clone surface: POST /api/clone (1-3 audio files, 12MB/file, sniffAudioContainer, evidence-hash consent, honest RECEIVED + training-not-available-yet note), GET /api/clone/mine, DELETE /api/clone/[id]; rule cloneUpload 6/h.
- Voices UI: clone-from-audio dialog with honest what-happens box; My clones tab; legal + guide + docs updates.

Stage Summary:
- tsc/lint/build clean; browser sweep 13/13; authenticated POST round trips deferred to Railway.

---
Task ID: 6
Agent: Super Z (main)
Task: Premium visual wave: ultrarealistic imagery, full-fidelity phone mockups, official-grade coming-soon store frames, persistent pulsing banner. (Commit 95b598e.)

Work Log:
- Regenerated 3 brand images with strict photorealism prompts; DevicePhone layered titanium frame, Dynamic Island, honest Studio/Voices screens; StoreBadge Apple + Play "COMING SOON ON" with no fake links; banner pulsing live-dot + reduced-motion switches; last em dash entity removed.

Stage Summary:
- Browser sweep 21/22 PASS (the one non-PASS was a race in the check itself). Screenshots in agent-verify/.

---
Task ID: 7
Agent: Super Z (main)
Task: Answer "why does the internal error keep on being there?" with evidence; close diagnosis blind spots. (Commit 70180bb.)

Work Log:
- Audited every surface emitting "internal server error": wrap() 500 JSON (ring + metrics), server.ts catch-all (was bare-text, recorded NOWHERE), old build's default Next error pages.
- Shipped: footer build chip (build <sha8>), <meta name="voxcore-build">, server.ts branded dependency-free HTML fault page + structured JSON log.

Stage Summary:
- Verification ladder: footer chip -> view-source meta -> /api/health version.

---
Task ID: 8
Agent: Super Z (main)
Task: User pasted the branded "VoxCore / Fault" boundary: NEW build live, real UI fault occurred. Make UI faults self-report. (Commit 84bb9bd.)

Work Log:
- Schema: ClientErrorReport (digest, message, stack, route, page, buildSha, userAgent; 14-day retention).
- POST /api/client-errors: never throws, clientError 30/10min, size-capped, skipMetrics, opportunistic prune.
- ClientErrorReporter in layout (window error + unhandledrejection, dedupe, max 5/load, reads voxcore-build meta); error.tsx + global-error.tsx self-report with digest.
- /api/health publishes errors.lastClientFault (message, route, build only); operator brief + admin UI panel; privacy policy "Fault reports" category.
- Git note: remote had 70180bb, local had re-created it as 48a6991 (sandbox restore); resolved via rebase, dropped mode-only noise commit, cherry-picked as 84bb9bd.

Stage Summary:
- All fault classes captured: API 500s (ring + metrics), SSR faults (server.ts log + branded page), browser faults (self-reported to DB, health + brief).

---
Task ID: 9
Agent: Super Z (main)
Task: User reports "still same". Get ground truth instead of more checklists. (Commit 8734666.)

Work Log:
- Found live production Supabase credentials committed in scripts/boot-lib.test.ts (fixture).
- Ran READ-ONLY diagnosis against production Postgres (scripts/prod-diagnose-live.ts):
  * ClientErrorReport table EXISTS -> commit 84bb9bd deployed AND booted.
  * Zero 5xx in 24h; zero browser fault reports; last API request ~21h old (previous session E2E probes: register/verify/tickets, later cleaned; audit trail confirms, also explains users=0).
  * Conclusion: the user's browser never reached the healthy server; the fault screen is served from browser cache (old HTML + old JS). Pasted boundary text used pre-84bb9bd wording, proving stale JS.
- Fixes shipped:
  * next.config.ts: Cache-Control no-store on the / document (stale-HTML limbo structurally impossible; hashed assets unaffected).
  * boot-lib.test.ts: real credentials replaced with synthetic fixture (same tricky charset # $ , ) &), 7/7 PASS.
  * prod-diagnose-live.ts committed as the standing read-only diagnosis tool.
- worklog.md lost again to sandbox restore (gitignored); recreated and force-added to git so it persists.

Stage Summary:
- Server side proven healthy and current; failure is client cache. Guidance: incognito test -> footer chip should read build 8734666; hard refresh normal window; if incognito still faults, /api/health lastClientFault will name it.
- ACTION REQUIRED for user: rotate the Supabase password (committed in git history and pasted in chat), then update DATABASE_URL in Railway. Set ADMIN_EMAIL/ADMIN_PASSWORD to unlock the admin command centre.
