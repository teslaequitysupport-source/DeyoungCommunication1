"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard, EmptyState, formatDate, formatCents } from "@/components/app/ui-bits";
import { apiGet } from "@/lib/client/api";

interface BillingOverview {
  balanceCents: number;
  usage: { minutesToday: number; minutesThisMonth: number; totalMinutes: number; totalCostCents: number };
  limits: { planCode: string; planName: string; maxMinutesPerDay: number; maxMinutesPerMonth: number; maxModelUploads: number; allowedTiers: string[]; status: string; monthlyFreeCreditCents: number } | null;
  ledger: { id: string; deltaCents: number; balanceAfterCents: number; reason: string; note: string | null; createdAt: string }[];
  chargingNote: string;
}

interface UsageRecord {
  id: string;
  kind: string;
  quantity: number;
  rateMilliUsd: number;
  costCents: number;
  createdAt: string;
}

export default function BillingView() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [usage, setUsage] = useState<UsageRecord[] | null>(null);

  useEffect(() => {
    apiGet<BillingOverview>("/api/billing/overview").then(setOverview).catch(() => {});
    apiGet<{ records: UsageRecord[] }>("/api/billing/usage").then((d) => setUsage(d.records)).catch(() => setUsage([]));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Billing and usage</h1>
      <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
        {overview?.chargingNote}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Credit balance" value={overview ? formatCents(overview.balanceCents) : "..."} />
        <StatCard label="Plan" value={overview?.limits?.planName ?? "..."} sub={overview?.limits ? `${overview.limits.allowedTiers.join(", ")} tiers` : undefined} />
        <StatCard label="Usage cost to date" value={overview ? formatCents(overview.usage.totalCostCents) : "..."} sub="Metered server-side, never client-computed" />
        <StatCard label="Monthly allowance" value={overview?.limits ? formatCents(overview.limits.monthlyFreeCreditCents) : "..."} sub="Granted automatically each month on paid plans" />
      </div>

      <Tabs defaultValue="ledger" className="mt-8">
        <TabsList>
          <TabsTrigger value="ledger">Credit ledger</TabsTrigger>
          <TabsTrigger value="usage">Usage records</TabsTrigger>
        </TabsList>
        <TabsContent value="ledger" className="mt-4">
          {!overview || overview.ledger.length === 0 ? (
            <EmptyState title="No ledger entries yet" body="Credit grants and consumption events appear here with running balances. Every entry is idempotent: retries can never double-apply." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Change</th>
                    <th className="px-4 py-3 font-medium">Balance after</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {overview.ledger.map((e) => (
                    <tr key={e.id} className="bg-white dark:bg-zinc-950">
                      <td className={`px-4 py-3 font-mono tabular-nums ${e.deltaCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {e.deltaCents >= 0 ? "+" : ""}{formatCents(e.deltaCents)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{formatCents(e.balanceAfterCents)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{e.reason}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{e.note ?? "-"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          {usage === null ? (
            <div className="flex justify-center py-10"><span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>
          ) : usage.length === 0 ? (
            <EmptyState title="No usage yet" body="Sessions write metered records server-side: minutes, audio seconds and storage." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Kind</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Rate</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {usage.map((u) => (
                    <tr key={u.id} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3 font-mono text-xs">{u.kind}</td>
                      <td className="px-4 py-3 tabular-nums text-xs">{Math.round(u.quantity * 100) / 100}</td>
                      <td className="px-4 py-3 tabular-nums text-xs">{u.rateMilliUsd} milli-USD/unit</td>
                      <td className="px-4 py-3 tabular-nums text-xs">{formatCents(u.costCents)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Card className="mt-8 border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Why there is no checkout</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            Charging was deliberately deferred by product decision. When a payment provider is selected it will plug into the existing PaymentProvider interface and the same ledger, with server-side webhook verification and idempotent entitlement sync. Nothing in this deployment pretends to take money.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-zinc-500">
          Refund and cancellation policies are published for the future paid product (see the footer); until charging exists they describe the zero-charge reality: nothing can be billed, so nothing needs refunding.
        </CardContent>
      </Card>
    </div>
  );
}
