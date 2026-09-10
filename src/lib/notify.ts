import { db } from "@/lib/db";

// Notification service: in-app inbox entries. Email and push are documented
// integrations that require deployment credentials and are not configured in
// this environment; the emailMode=none limitation is surfaced in the admin panel.

export type NotificationKind = "SYSTEM" | "SUPPORT" | "SESSION" | "BILLING" | "SECURITY";

export async function notify(input: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  data?: unknown;
}): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        data: input.data !== undefined ? JSON.stringify(input.data) : null,
      },
    });
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "notify_failed", userId: input.userId, err: String(e) }));
  }
}
