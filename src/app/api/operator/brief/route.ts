import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { recentRouteErrors } from "@/lib/error-ring";

// Operator brief: live deployment state plus internal operator notes.
// The entire response is gated behind requireAdmin(): anyone else receives
// 403 and a PERMISSION_DENIED security event. The internal write-ups below
// exist ONLY in this server response - they are never embedded in the
// client bundle, so a non-admin cannot read them even from shipped JS.

export const GET = wrap(
  async () => {
    await requireAdmin();

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const [usersTotal, usersSuspended, modelsPending, modelsApproved, modelsTakenDown, workersByStatus, sessionsActive, queueWaiting, ticketsOpen, rateLimited24h, denied24h, requests24h] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: "SUSPENDED" } }),
      db.voiceModel.count({ where: { status: "PENDING_REVIEW" } }),
      db.voiceModel.count({ where: { status: "APPROVED" } }),
      db.voiceModel.count({ where: { status: "TAKEN_DOWN" } }),
      db.worker.groupBy({ by: ["status"], _count: { _all: true } }),
      db.conversionSession.count({ where: { status: "ACTIVE" } }),
      db.queueEntry.count({ where: { status: "WAITING" } }),
      db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_USER"] } } }),
      db.securityEvent.count({ where: { kind: "RATE_LIMITED", createdAt: { gte: dayAgo } } }),
      db.securityEvent.count({ where: { kind: "PERMISSION_DENIED", createdAt: { gte: dayAgo } } }),
      db.requestMetric.count({ where: { createdAt: { gte: dayAgo } } }),
    ]);

    const workerCounts: Record<string, number> = {};
    let workersTotal = 0;
    for (const row of workersByStatus) {
      const n = (row._count as { _all: number })._all ?? 0;
      workerCounts[row.status] = n;
      workersTotal += n;
    }

    const brief = {
      generatedAt: new Date().toISOString(),
      scope: "operator only",

      counts: {
        users: { total: usersTotal, suspended: usersSuspended },
        models: { pendingReview: modelsPending, approved: modelsApproved, takenDown: modelsTakenDown },
        workers: { total: workersTotal, byStatus: workerCounts },
        sessions: { active: sessionsActive },
        queue: { waiting: queueWaiting },
        tickets: { unresolved: ticketsOpen },
        security: { rateLimited24h: rateLimited24h, permissionDenied24h: denied24h },
        traffic: { requests24h: requests24h },
      },

      env: {
        nodeEnv: env.nodeEnv,
        adminEmailSet: Boolean(env.bootstrapAdminEmail),
        adminPasswordSet: Boolean(env.bootstrapAdminPassword),
        googleEnabled: env.googleEnabled,
        emailMode: env.emailMode,
        appOrigin: env.appOrigin,
        audioChunkMs: env.audioChunkMs,
        maxModelUploadMb: env.maxModelUploadMb,
      },

      // ---------------------------------------------------------------
      // INTERNAL WRITE-UPS (operator eyes only)
      // Honest, actionable, sometimes uncomfortable. Users never see
      // these: they are served from this ADMIN-gated endpoint only.
      // ---------------------------------------------------------------
      // Unhandled route errors (500s) captured in-process. This is the
      // one-look diagnosis: exact route, message and stack, without needing
      // platform log access. Reset on redeploy/restart by design.
      recentErrors: recentRouteErrors(),

      notes: [
        {
          id: "rotate-credentials",
          title: "Rotate exposed credentials",
          body:
            "The Supabase database password and a GitHub PAT were pasted into chat during setup. Rotate the Supabase password (Database settings), update DATABASE_URL in Railway variables, and revoke + reissue the GitHub PAT. Treat both as compromised until rotated.",
        },
        {
          id: "admin-bootstrap",
          title: "Create the real admin account",
          body:
            "No administrator exists until ADMIN_EMAIL and ADMIN_PASSWORD are set in Railway and the service is redeployed; the bootstrap admin is only seeded into an empty users table. Until then the command centre at /#/admin is unreachable.",
        },
        {
          id: "railway-ram",
          title: "Keep Railway at 1 GB RAM",
          body:
            "The Next server, audio gateway and self-hosted LOCAL worker share one container. 512 MB will OOM under a single live session. Set the service to at least 1 GB before inviting traffic.",
        },
        {
          id: "email-mode",
          title: "Email delivery is OFF",
          body:
            "EMAIL_MODE=none means verification and reset tokens are shown once at signup instead of being emailed. This is visible dev-mode behavior, never presented as production email. Wire SMTP before public launch.",
        },
        {
          id: "google-oauth",
          title: "Google sign-in is dormant by design",
          body:
            "The Google button appears only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are both set. Redirect URI: https://<your-domain>/api/auth/google/callback. An unconfigured provider is never advertised to users.",
        },
        {
          id: "gpu-reality",
          title: "GPU voice clones need a GPU worker",
          body:
            "The in-container LOCAL worker serves the DSP_CPU tier only - real-time DSP conversion is proven end-to-end. RVC model inference requires a GPU worker (Kaggle-assisted is burst-only by design, never always-on). Do not promise GPU clone quality from CPU sessions.",
        },
        {
          id: "billing-fence",
          title: "Charging stays deferred",
          body:
            "The credit ledger, metering and plan limits are live, but no payment provider is wired. Prices are unpublished on purpose until measured GPU cost data exists. Nothing can be charged in this build.",
        },
        {
          id: "moderation-duty",
          title: "Moderation is a human duty",
          body:
            "Uploads carry rights attestations and land in PENDING_REVIEW. The queue must be worked by a human (you) - check the moderation panel for pending models and open abuse reports. Takedowns are immediate and audit-logged.",
        },
      ],
    };

    return jsonOk({ brief });
  },
  { rule: "apiRead" }
);
