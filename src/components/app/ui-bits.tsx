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
// Skeleton loading primitives. A shimmer sweep (white hairline + red tint)
// over dark blocks - same geometry as the design system. All are decorative:
// aria-hidden with an sr-only "Loading" note where context matters.
// ---------------------------------------------------------------------------

export function Skeleton({ className, "aria-label": ariaLabel }: { className?: string; "aria-label"?: string }) {
  return (
    <>
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
      <div aria-hidden className={cn("skeleton", className)} />
    </>
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3"
          style={{ width: i === lines - 1 ? "62%" : `${100 - (i % 3) * 8}%` }}
        />
      ))}
    </div>
  );
}

// Skeleton for the StatCard grid (dashboards, operator counters).
export function SkeletonStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-white/10 bg-card p-4">
          <div className="skeleton h-2.5 w-20" />
          <div className="skeleton mt-3 h-7 w-16" />
          <div className="skeleton mt-3 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

// Skeleton for card grids (catalog, plans, features).
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-white/10 bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-4 w-12" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
          <div className="skeleton mt-5 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

// Skeleton for table rows (sessions, admin tables).
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("divide-y divide-white/5 border border-white/10", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 bg-card px-4 py-4">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-3 w-16" />
          <div className="skeleton ml-auto h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll progress hairline (top of viewport). rAF-batched, passive listener.
// ---------------------------------------------------------------------------
export function ScrollProgress({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      el.style.transform = `scaleX(${p.toFixed(4)})`;
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("scroll-progress absolute bottom-0 left-0 h-px w-full bg-red-600", className)}
      style={{ transform: "scaleX(0)" }}
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
