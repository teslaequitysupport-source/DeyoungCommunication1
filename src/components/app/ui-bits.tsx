"use client";

// Small shared UI atoms used across user and admin views.
// Palette discipline: white = healthy/positive, hollow = pending/warning,
// red = danger/action, neutral grays = terminal states. No other hues.

import { useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const GOOD = "bg-white text-zinc-950 border-white";
const WARN = "bg-transparent text-zinc-100 border-white/35";
const BAD = "bg-red-600 text-white border-red-500";
const NEUTRAL = "bg-zinc-900 text-zinc-400 border-zinc-700";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status.toUpperCase();
  const map: Record<string, string> = {
    // positive
    ACTIVE: GOOD,
    READY: GOOD,
    APPROVED: GOOD,
    PASSED: GOOD,
    RESOLVED: GOOD,
    IDLE: GOOD,
    CONNECTED: GOOD,
    // warning / in-flight
    PENDING_REVIEW: WARN,
    QUEUED: WARN,
    ASSIGNING: WARN,
    CONNECTING: WARN,
    DRAINING: WARN,
    WARN: WARN,
    IN_PROGRESS: WARN,
    WAITING_USER: WARN,
    ACK: WARN,
    WARMING: WARN,
    LOADING_MODEL: WARN,
    BOOTING: WARN,
    RESTARTING: WARN,
    STOPPING: WARN,
    SUSPENDED: WARN,
    PENDING_VERIFICATION: WARN,
    // danger
    FAILED: BAD,
    UNHEALTHY: BAD,
    QUARANTINED: BAD,
    REJECTED: BAD,
    TAKEN_DOWN: BAD,
    CRITICAL: BAD,
    CANCELLED: BAD,
    CLOSED: BAD,
    EMERGENCY: BAD,
    // neutral
    STOPPED: NEUTRAL,
    ENDED: NEUTRAL,
    DISABLED: NEUTRAL,
    OPEN: WARN,
  };
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px] tracking-wide", map[s] ?? NEUTRAL, className)}>
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

export function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  return (
    <div className="border border-zinc-200/10 bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className={cn(
        "mt-1.5 text-2xl font-semibold tabular-nums",
        tone === "good" && "text-white",
        tone === "warn" && "text-red-400",
        tone === "bad" && "text-red-500",
        (!tone || tone === "default") && "text-white",
      )}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-zinc-700 p-10 text-center">
      <p className="font-medium text-zinc-200">{title}</p>
      <p className="mt-1 max-w-md text-sm text-zinc-500">{body}</p>
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
      className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// 3D tilt surface: mouse-tracked rotateX/rotateY with perspective. Disabled
// for touch pointers and reduced-motion users (renders as a static card).
// ---------------------------------------------------------------------------
export function TiltCard({ className, children, max = 6 }: { className?: string; children: React.ReactNode; max?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animOff = document.documentElement.dataset.anim === "off";
    enabledRef.current = fine && !reduced && !animOff;
  }, []);

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el || !enabledRef.current) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-2px)`;
      el.style.setProperty("--mx", `${(px * 100 + 50).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100 + 50).toFixed(1)}%`);
    },
    [max]
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)";
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("tilt transition-transform duration-200 ease-out", className)}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll reveal: adds .is-visible once when the element enters the viewport.
// ---------------------------------------------------------------------------
export function Reveal({ className, children, delay = 0 }: { className?: string; children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.anim === "off") {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            io.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("reveal", className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
