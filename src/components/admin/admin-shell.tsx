"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, StatCard, EmptyState, formatDate, formatCents, Spinner } from "@/components/app/ui-bits";
import { apiGet, apiSend, ApiClientError } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import AdminPanels from "@/components/admin/admin-panels";

// ADMIN COMMAND CENTRE
//
// A separate control plane with its own dark, dense visual language. This is
// not the customer dashboard with a label: fleet control, provisioning,
// moderation, budgets, audit chain verification and the test lab live here.

const NAV = [
  { key: "overview", label: "Overview" },
  { key: "workers", label: "GPU workers" },
  { key: "models", label: "Moderation" },
  { key: "users", label: "Users" },
  { key: "billing", label: "Billing" },
  { key: "support", label: "Support" },
  { key: "alerts", label: "Alerts" },
  { key: "security", label: "Security" },
  { key: "audit", label: "Audit" },
  { key: "settings", label: "Site settings" },
  { key: "budgets", label: "Budgets" },
  { key: "testlab", label: "Test lab" },
];

export interface WorkerRow {
  id: string; name: string; providerCode: string; costKind: string; region: string | null;
  gpuName: string | null; vramMb: number | null; status: string; tiers: string[];
  maxSessions: number; activeSessions: number; totalSessions: number;
  lastHeartbeatAt: string | null; registeredAt: string; lastError: string | null;
  pendingCommands: number; agentVersion: string | null; pythonVersion: string | null;
  cudaVersion: string | null; os: string | null;
}

export default function AdminShell({ route, navigate }: { route: string; navigate: (to: string) => void }) {
  const section = route.split("/")[0] || "overview";
  return (
    <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6">
      <nav className="sticky top-20 hidden h-fit w-52 shrink-0 flex-col gap-0.5 lg:flex" aria-label="Admin sections">
        <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Command centre</p>
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => navigate(`admin/${n.key}`)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm transition-colors",
              section === n.key ? "bg-violet-950/60 font-medium text-violet-200" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
            )}
            aria-current={section === n.key ? "page" : undefined}
          >
            {n.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap gap-1.5 lg:hidden">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => navigate(`admin/${n.key}`)}
              className={cn("rounded-md border px-2.5 py-1 text-xs", section === n.key ? "border-violet-800 bg-violet-950/60 text-violet-200" : "border-zinc-800 text-zinc-400")}>
              {n.label}
            </button>
          ))}
        </div>
        {section === "overview" ? <Overview navigate={navigate} /> : <AdminPanels section={section} />}
      </div>
    </div>
  );
}

interface OverviewData {
  fleet: { alive: number; unhealthy: number; byProvider: { provider: string; count: number }[] };
  sessions: { active: number; queued: number; last24h: number };
  moderation: { pendingModels: number; openReports: number };
  users: { total: number; suspended: number };
  ops: { openAlerts: number; openTickets: number; apiP95Ms: number | null; apiErrorRate: number; samples: number };
  costs: { todayCents: number; monthCents: number };
}

function Overview({ navigate }: { navigate: (to: string) => void }) {
  const [data, setData] = useState<OverviewData | null>(null);
  useEffect(() => {
    const load = () => apiGet<OverviewData>("/api/admin/overview").then(setData).catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Platform overview</h1>
      <p className="mt-1 text-xs text-zinc-500">Live system state. Every figure is computed from the operational database on load.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Workers alive" value={data.fleet.alive} sub={data.fleet.unhealthy > 0 ? `${data.fleet.unhealthy} unhealthy` : "no unhealthy workers"} tone={data.fleet.unhealthy > 0 ? "warn" : "good"} />
        <StatCard label="Active sessions" value={data.sessions.active} sub={`${data.sessions.queued} queued`} />
        <StatCard label="Paid GPU spend today" value={formatCents(data.costs.todayCents)} sub={`month: ${formatCents(data.costs.monthCents)}`} tone={data.costs.todayCents > 0 ? "warn" : "good"} />
        <StatCard label="Open alerts" value={data.ops.openAlerts} sub={`${data.ops.openTickets} open tickets`} tone={data.ops.openAlerts > 0 ? "warn" : "good"} />
        <StatCard label="Moderation queue" value={data.moderation.pendingModels} sub={`${data.moderation.openReports} open reports`} tone={data.moderation.pendingModels > 0 ? "warn" : "default"} />
        <StatCard label="Users" value={data.users.total} sub={`${data.users.suspended} suspended`} />
        <StatCard label="API p95 (15 min)" value={data.ops.apiP95Ms !== null ? `${data.ops.apiP95Ms} ms` : "no samples"} sub={`${data.ops.samples} requests sampled`} />
        <StatCard label="API error rate" value={`${Math.round(data.ops.apiErrorRate * 1000) / 10}%`} sub="5xx responses, last 15 min" tone={data.ops.apiErrorRate > 0.05 ? "bad" : "good"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-base">Fleet by provider</CardTitle>
            <CardDescription>Registered workers grouped by capacity source.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.fleet.byProvider.length === 0 ? (
              <p className="text-sm text-zinc-500">No workers registered. Use GPU workers to provision one.</p>
            ) : (
              data.fleet.byProvider.map((p) => (
                <div key={p.provider} className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{p.provider}</span>
                  <span className="tabular-nums text-zinc-400">{p.count}</span>
                </div>
              ))
            )}
            <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("admin/workers")}>Manage workers</Button>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Common operator paths.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("admin/workers")}>Provision a worker</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("admin/models")}>Review submissions</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("admin/testlab")}>Run a conversion test</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("admin/budgets")}>Check budgets</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function WorkersPanel() {
  const { toast } = useToast();
  const [workers, setWorkers] = useState<WorkerRow[] | null>(null);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [provider, setProvider] = useState("LOCAL");
  const [name, setName] = useState("");
  const [tier, setTier] = useState("DSP_CPU");

  const load = useCallback(() => {
    apiGet<{ workers: WorkerRow[] }>("/api/admin/workers").then((d) => setWorkers(d.workers)).catch(() => setWorkers([]));
  }, []);
  useEffect(load, []);

  const provision = async () => {
    setBusy(true);
    try {
      const res = await apiSend<{ workerId?: string; artifact?: string; instructions?: string }>("/api/admin/workers/provision", "POST", { providerCode: provider, name: name || undefined, tier });
      setScript(res.artifact ?? res.instructions ?? null);
      toast({ title: "Provisioning started", description: res.instructions?.slice(0, 140) ?? "Worker created." });
      load();
    } catch (err) {
      toast({ title: "Provisioning failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const action = async (id: string, act: string) => {
    try {
      await apiSend(`/api/admin/workers/${id}`, "POST", { action: act, reason: act === "quarantine" ? "Manual quarantine from command centre" : undefined });
      toast({ title: `Action sent: ${act}` });
      load();
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">GPU worker fleet</h1>
          <p className="mt-1 text-xs text-zinc-500">Registry, heartbeats, lifecycle actions. Workers poll commands over outbound connections only.</p>
        </div>
        <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
          <DialogTrigger asChild><Button className="bg-violet-600 hover:bg-violet-500">Provision worker</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Provision capacity</DialogTitle>
              <DialogDescription>
                LOCAL spawns the Python agent on this machine immediately. KAGGLE_ASSISTED generates a paste-ready notebook cell: Kaggle cannot be launched programmatically, so that path is assisted and honestly labeled.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prov-provider">Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="prov-provider"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCAL">Local machine (autonomous)</SelectItem>
                    <SelectItem value="KAGGLE_ASSISTED">Kaggle notebook (assisted)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-name">Name (optional)</Label>
                <Input id="prov-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. kaggle-t4-01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-tier">Target tier</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger id="prov-tier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DSP_CPU">DSP (CPU)</SelectItem>
                    <SelectItem value="RVC_GPU">RVC (GPU)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {script ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <p className="mb-2 text-xs text-zinc-400">Paste-ready artifact (registration token is embedded and single-use):</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-emerald-300">{script}</pre>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard?.writeText(script); toast({ title: "Copied" }); }}>Copy</Button>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setProvisionOpen(false); setScript(null); }}>Close</Button>
              <Button className="bg-violet-600 hover:bg-violet-500" onClick={provision} disabled={busy}>{busy ? <Spinner /> : "Provision"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6">
        {workers === null ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : workers.length === 0 ? (
          <EmptyState title="No workers registered" body="Provision a local worker to verify the full pipeline, or generate a Kaggle cell for free GPU capacity." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Worker</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Hardware</th>
                  <th className="px-3 py-2.5 font-medium">Tiers</th>
                  <th className="px-3 py-2.5 font-medium">Sessions</th>
                  <th className="px-3 py-2.5 font-medium">Last heartbeat</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {workers.map((w) => (
                  <tr key={w.id} className="bg-zinc-950">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{w.name}</div>
                      <div className="font-mono text-[10px] text-zinc-500">{w.providerCode} / {w.costKind} / {w.region ?? "?"}</div>
                      {w.lastError ? <div className="text-[10px] text-rose-400">{w.lastError.slice(0, 90)}</div> : null}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={w.status} /></td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400">
                      {w.gpuName ? `${w.gpuName} (${Math.round((w.vramMb ?? 0) / 1024)}GB)` : "CPU only"}
                      <div className="text-[10px]">{w.os ?? "?"} / py {w.pythonVersion ?? "?"}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {w.tiers.map((t) => <span key={t} className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">{t}</span>)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">{w.activeSessions}/{w.maxSessions}<div className="text-[10px] text-zinc-500">{w.totalSessions} total</div></td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400">{w.lastHeartbeatAt ? formatDate(w.lastHeartbeatAt) : "never"}
                      {w.pendingCommands > 0 ? <div className="text-[10px] text-amber-400">{w.pendingCommands} pending cmd</div> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => action(w.id, "ping")}>Ping</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => action(w.id, "drain")}>Drain</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => action(w.id, "restart")}>Restart</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => action(w.id, "stop")}>Stop</Button>
                        {w.status !== "QUARANTINED" ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-rose-300" onClick={() => action(w.id, "quarantine")}>Quarantine</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => action(w.id, "activate")}>Reactivate</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
