"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { StatusBadge, StatCard, EmptyState, formatDate, formatCents, SkeletonStats, SkeletonRows } from "@/components/app/ui-bits";
import { apiGet, Me } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";

interface SessionRow {
  id: string;
  status: string;
  endReason: string | null;
  model: string;
  engine: string;
  tier: string | null;
  worker: string | null;
  provider: string | null;
  queuedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  audioSeconds: number;
  metrics: { p50Ms?: number; p95Ms?: number; packetsSent?: number; packetsReceived?: number; dropsPct?: number } | null;
}

interface BillingOverview {
  balanceCents: number;
  usage: { minutesToday: number; minutesThisMonth: number; totalMinutes: number; totalCostCents: number };
  limits: { planCode: string; planName: string; maxMinutesPerDay: number; maxMinutesPerMonth: number; maxConcurrentSessions: number; allowedTiers: string[]; status: string } | null;
  chargingNote: string;
}

export default function DashboardView({ navigate, me, refreshMe }: { navigate: (to: string) => void; me: Me | null; refreshMe: () => Promise<void> }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = () => {
      apiGet<{ sessions: SessionRow[] }>("/api/sessions").then((d) => setSessions(d.sessions)).catch(() => setSessions([]));
      apiGet<BillingOverview>("/api/billing/overview").then(setBilling).catch(() => {});
    };
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  const user = me?.user;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Plan {billing?.limits?.planName ?? "..."} &middot; signed in as {user?.email}
            {user?.emailVerifiedAt ? "" : " (email unverified; verification is required for uploads)"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-red-600 hover:bg-red-500" onClick={() => navigate("studio")}>Open studio</Button>
          <Button variant="outline" onClick={() => navigate("account")}>Account</Button>
        </div>
      </div>

      {!user?.emailVerifiedAt ? (
        <Alert className="mt-6 border-white/25 bg-white/5">
          <AlertDescription className="text-zinc-100">
            Your email is not verified yet. Sessions work, but model uploads stay locked until verification. If you lost the token, use resend verification on the account page.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-6">
        {billing ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Credit balance" value={formatCents(billing.balanceCents)} sub="Consumed by measured usage; granted by admins (charging deferred)" />
            <StatCard label="Minutes today" value={`${Math.round(billing.usage.minutesToday * 10) / 10}`} sub={billing.limits ? `Plan limit ${billing.limits.maxMinutesPerDay} min` : undefined} tone={(billing.usage.minutesToday ?? 0) > (billing.limits?.maxMinutesPerDay ?? 1) * 0.8 ? "warn" : "default"} />
            <StatCard label="Minutes this month" value={`${Math.round(billing.usage.minutesThisMonth * 10) / 10}`} sub={billing.limits ? `Plan limit ${billing.limits.maxMinutesPerMonth} min` : undefined} />
            <StatCard label="Metered cost" value={formatCents(billing.usage.totalCostCents)} sub="What your usage consumed in credits" />
          </div>
        ) : (
          <SkeletonStats count={4} />
        )}
      </div>

      {billing?.limits ? (
        <Card className="mt-4 border-zinc-200 dark:border-zinc-800">
          <CardContent className="pt-4">
            {[
              { label: "Daily minutes", used: billing.usage.minutesToday, max: billing.limits.maxMinutesPerDay },
              { label: "Monthly minutes", used: billing.usage.minutesThisMonth, max: billing.limits.maxMinutesPerMonth },
            ].map((row) => (
              <div key={row.label} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between text-xs text-zinc-500">
                  <span>{row.label}</span>
                  <span className="tabular-nums">{Math.round(row.used * 10) / 10} / {row.max}</span>
                </div>
                <Progress value={Math.min(100, (row.used / Math.max(1, row.max)) * 100)} aria-label={`${row.label} usage`} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Recent sessions</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("studio")}>Start a session</Button>
        </div>
        {sessions === null ? (
          <SkeletonRows rows={4} />
        ) : sessions.length === 0 ? (
          <EmptyState title="No sessions yet" body="Open the studio, pick a voice and speak. Your sessions will appear here with measured latency percentiles." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Worker</th>
                  <th className="px-4 py-3 font-medium">P50 / P95</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sessions.map((s) => (
                  <tr key={s.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.model}</div>
                      <div className="text-xs text-zinc-400">{s.engine}{s.tier ? ` / ${s.tier}` : ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                      {s.endReason ? <div className="mt-1 text-xs text-zinc-400">{s.endReason.replace(/_/g, " ").toLowerCase()}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {s.worker ?? "-"}
                      {s.provider ? <div className="text-zinc-400">{s.provider}</div> : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs">
                      {s.metrics ? `${Math.round(s.metrics.p50Ms ?? 0)} / ${Math.round(s.metrics.p95Ms ?? 0)} ms` : "-"}
                      {s.metrics?.dropsPct ? <div className="text-zinc-300">{s.metrics.dropsPct}% drops</div> : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs">{s.durationSec ? `${Math.round(s.durationSec)}s` : "-"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(s.queuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Card className="mt-10 border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">About credits and charging</CardTitle>
          <CardDescription className="text-xs leading-relaxed">{billing?.chargingNote}</CardDescription>
        </CardHeader>
      </Card>
      <button className="hidden" onClick={() => { refreshMe(); toast({ title: "Refreshed" }); }} />
    </div>
  );
}
