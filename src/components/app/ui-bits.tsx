"use client";

// Small shared UI atoms used across user and admin views.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status.toUpperCase();
  const map: Record<string, string> = {
    // positive
    ACTIVE: "bg-emerald-950 text-emerald-300 border-emerald-800",
    READY: "bg-emerald-950 text-emerald-300 border-emerald-800",
    APPROVED: "bg-emerald-950 text-emerald-300 border-emerald-800",
    PASSED: "bg-emerald-950 text-emerald-300 border-emerald-800",
    RESOLVED: "bg-emerald-950 text-emerald-300 border-emerald-800",
    IDLE: "bg-emerald-950 text-emerald-300 border-emerald-800",
    CONNECTED: "bg-emerald-950 text-emerald-300 border-emerald-800",
    // warning
    PENDING_REVIEW: "bg-amber-950 text-amber-300 border-amber-800",
    QUEUED: "bg-amber-950 text-amber-300 border-amber-800",
    ASSIGNING: "bg-amber-950 text-amber-300 border-amber-800",
    CONNECTING: "bg-amber-950 text-amber-300 border-amber-800",
    DRAINING: "bg-amber-950 text-amber-300 border-amber-800",
    WARN: "bg-amber-950 text-amber-300 border-amber-800",
    IN_PROGRESS: "bg-amber-950 text-amber-300 border-amber-800",
    WAITING_USER: "bg-amber-950 text-amber-300 border-amber-800",
    ACK: "bg-amber-950 text-amber-300 border-amber-800",
    WARMING: "bg-amber-950 text-amber-300 border-amber-800",
    LOADING_MODEL: "bg-amber-950 text-amber-300 border-amber-800",
    BOOTING: "bg-amber-950 text-amber-300 border-amber-800",
    RESTARTING: "bg-amber-950 text-amber-300 border-amber-800",
    STOPPING: "bg-amber-950 text-amber-300 border-amber-800",
    SUSPENDED: "bg-amber-950 text-amber-300 border-amber-800",
    PENDING_VERIFICATION: "bg-amber-950 text-amber-300 border-amber-800",
    // danger
    FAILED: "bg-rose-950 text-rose-300 border-rose-800",
    UNHEALTHY: "bg-rose-950 text-rose-300 border-rose-800",
    QUARANTINED: "bg-rose-950 text-rose-300 border-rose-800",
    REJECTED: "bg-rose-950 text-rose-300 border-rose-800",
    TAKEN_DOWN: "bg-rose-950 text-rose-300 border-rose-800",
    CRITICAL: "bg-rose-950 text-rose-300 border-rose-800",
    CANCELLED: "bg-rose-950 text-rose-300 border-rose-800",
    CLOSED: "bg-rose-950 text-rose-300 border-rose-800",
    EMERGENCY: "bg-rose-950 text-rose-300 border-rose-800",
    // neutral
    STOPPED: "bg-zinc-800 text-zinc-300 border-zinc-700",
    ENDED: "bg-zinc-800 text-zinc-300 border-zinc-700",
    DISABLED: "bg-zinc-800 text-zinc-300 border-zinc-700",
    OPEN: "bg-violet-950 text-violet-300 border-violet-800",
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px] tracking-wide", map[s] ?? "bg-zinc-800 text-zinc-300 border-zinc-700", className)}>
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={cn(
        "mt-1.5 text-2xl font-semibold tabular-nums",
        tone === "good" && "text-emerald-600 dark:text-emerald-400",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "bad" && "text-rose-600 dark:text-rose-400",
        (!tone || tone === "default") && "text-zinc-900 dark:text-zinc-100",
      )}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
      <p className="font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
      <p className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{body}</p>
    </div>
  );
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent", className)}
    />
  );
}
