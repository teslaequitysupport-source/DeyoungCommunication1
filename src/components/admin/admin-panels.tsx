"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, EmptyState, formatDate, formatCents, Spinner } from "@/components/app/ui-bits";
import { apiGet, apiSend, ApiClientError } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";

// Remaining command-centre sections: moderation, users, billing, support,
// alerts, security, audit, settings, budgets, test lab. Dark theme, dense.

export default function AdminPanels({ section }: { section: string }) {
  switch (section) {
    case "models": return <ModerationPanel />;
    case "users": return <UsersPanel />;
    case "billing": return <BillingPanel />;
    case "support": return <SupportPanel />;
    case "alerts": return <AlertsPanel />;
    case "security": return <SecurityPanel />;
    case "audit": return <AuditPanel />;
    case "settings": return <SettingsPanel />;
    case "budgets": return <BudgetsPanel />;
    case "testlab": return <TestLabPanel />;
    default: return <EmptyState title="Unknown section" body="Pick a section from the sidebar." />;
  }
}

// ---------------------------------------------------------------- MODERATION

interface ModelRow {
  id: string; name: string; kind: string; engine: string; status: string;
  description: string | null; licenseName: string; licenseUrl: string | null;
  licenseVerified: boolean; rightsAttested: boolean; fileName: string | null;
  fileSize: number | null; fileSha256: string | null;
  owner: { id: string; email: string } | null; openReports: number;
  rejectionReason: string | null; takedownReason: string | null;
  createdAt: string; reviewedAt: string | null;
}

function ModerationPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [models, setModels] = useState<ModelRow[] | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);

  const load = useCallback(() => {
    apiGet<{ models: ModelRow[] }>(`/api/admin/models?status=${status}`).then((d) => setModels(d.models)).catch(() => setModels([]));
    apiGet<{ reports: ReportRow[] }>("/api/admin/models").then((d) => setReports(d.reports)).catch(() => {});
  }, [status]);
  useEffect(load, [load]);

  const act = async (id: string, action: string) => {
    let reason: string | undefined;
    if (action === "reject" || action === "takedown") {
      reason = window.prompt(`Reason for ${action} (required, shown to the uploader):`) || undefined;
      if (!reason) return;
    }
    try {
      await apiSend(`/api/admin/models/${id}`, "POST", { action, reason });
      toast({ title: `Model ${action}d` });
      load();
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  const statuses = ["PENDING_REVIEW", "APPROVED", "REJECTED", "TAKEN_DOWN", "ALL"];

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Moderation</h1>
      <p className="mt-1 text-xs text-zinc-500">Human review of uploads. Approval requires license metadata; the file itself is never executed server-side.</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {statuses.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-md border px-2.5 py-1 text-xs ${status === s ? "border-red-800 bg-red-950/60 text-red-200" : "border-zinc-800 text-zinc-400"}`}>
            {s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {models === null ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : models.length === 0 ? (
          <EmptyState title="Nothing in this queue" body="Submissions appear here for review with their license metadata, attestation state and file hash." />
        ) : (
          models.map((m) => (
            <Card key={m.id} className="border-zinc-800 bg-zinc-950">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{m.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {m.openReports > 0 ? <StatusBadge status="FAILED" className="!bg-red-950 !text-red-300 !border-red-800" /> : null}
                    <StatusBadge status={m.status} />
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {m.kind === "SYSTEM_DSP" ? "System built-in" : `by ${m.owner?.email ?? "unknown"}`} &middot; submitted {formatDate(m.createdAt)}
                  {m.openReports > 0 ? ` &middot; ${m.openReports} open report(s)` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-xs text-zinc-400 lg:grid-cols-2">
                <div className="space-y-1">
                  <p>{m.description ?? "No description"}</p>
                  <p>License: <span className="text-zinc-200">{m.licenseName}</span>{m.licenseVerified ? " (verified)" : " (UNVERIFIED)"} {m.licenseUrl ? <a className="text-red-400 underline" href={m.licenseUrl} target="_blank" rel="noreferrer noopener">link</a> : null}</p>
                  <p>Attestation: {m.rightsAttested ? "signed, evidence hashed" : "missing"}</p>
                </div>
                <div className="space-y-1 font-mono text-[10px]">
                  <p>{m.fileName} &middot; {m.fileSize ? `${Math.round(m.fileSize / 1024)} KB` : "n/a"}</p>
                  <p className="break-all">sha256: {m.fileSha256 ?? "n/a"}</p>
                </div>
                {m.kind !== "SYSTEM_DSP" ? (
                  <div className="flex flex-wrap gap-2 lg:col-span-2">
                    <Button size="sm" className="bg-white text-zinc-950 hover:bg-zinc-200" onClick={() => act(m.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => act(m.id, "reject")}>Reject</Button>
                    <Button size="sm" variant="outline" className="text-red-300" onClick={() => act(m.id, "takedown")}>Takedown</Button>
                    <Button size="sm" variant="outline" onClick={() => act(m.id, "disable")}>Disable</Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">Open abuse reports</h2>
      <div className="mt-3 space-y-2">
        {reports.length === 0 ? (
          <p className="text-sm text-zinc-500">No open reports.</p>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{r.model?.name ?? "model"}</span>
                <span className="ml-2 font-mono text-xs text-zinc-200">{r.reason}</span>
                <span className="ml-2 text-xs text-zinc-500">by {r.reporter?.email}</span>
                {r.detail ? <div className="text-xs text-zinc-400">{r.detail}</div> : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await apiSend("/api/admin/models", "POST", { reportId: r.id, action: "review", resolution: "Reviewed in command centre" }); load(); }}>Mark reviewed</Button>
                <Button size="sm" variant="outline" onClick={async () => { await apiSend("/api/admin/models", "POST", { reportId: r.id, action: "dismiss", resolution: "Dismissed" }); load(); }}>Dismiss</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface ReportRow {
  id: string; reason: string; detail: string | null; status: string;
  model: { id: string; name: string; status: string } | null;
  reporter: { email: string } | null; createdAt: string;
}

// --------------------------------------------------------------------- USERS

interface UserRow {
  id: string; email: string; name: string | null; role: string; status: string;
  emailVerified: boolean; createdAt: string; lastLoginAt: string | null;
  lockedUntil: string | null; plan: string | null;
}

function UsersPanel() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[] | null>(null);

  const load = useCallback(() => {
    apiGet<{ users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`).then((d) => setUsers(d.users)).catch(() => setUsers([]));
  }, [q]);
  useEffect(load, [load]);

  const act = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await apiSend(`/api/admin/users/${id}`, "POST", { action, ...extra });
      toast({ title: `Action sent: ${action.replace(/-/g, " ")}` });
      load();
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  const grant = (id: string) => {
    const input = window.prompt("Credit amount in cents (negative to deduct):");
    if (!input) return;
    const amountCents = parseInt(input, 10);
    if (!Number.isFinite(amountCents)) return;
    act(id, "grant-credits", { amountCents, note: "Admin grant from command centre" });
  };

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Users</h1>
      <div className="mt-4 flex max-w-md gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email..." aria-label="Search users" className="border-zinc-800 bg-zinc-900" />
      </div>
      <div className="mt-5">
        {users === null ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : users.length === 0 ? (
          <EmptyState title="No users match" body="Search finds exact substring matches on email." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 font-medium">State</th>
                  <th className="px-3 py-2.5 font-medium">Last login</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map((u) => (
                  <tr key={u.id} className="bg-zinc-950">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{u.email}</div>
                      <div className="text-[10px] text-zinc-500">{u.name ?? "no name"} / {u.role} / {u.emailVerified ? "verified" : "unverified"}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{u.plan ?? "-"}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={u.status} /></td>
                    <td className="px-3 py-2.5 text-xs text-zinc-400">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "never"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => grant(u.id)}>Credits</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { const p = window.prompt("Plan code (FREE, PRO, PREMIUM, BUSINESS):"); if (p) act(u.id, "adjust-plan", { planCode: p.toUpperCase() }); }}>Plan</Button>
                        {u.status === "SUSPENDED" ? (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => act(u.id, "restore")}>Restore</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-zinc-100" onClick={() => { const r = window.prompt("Suspension reason (required):"); if (r) act(u.id, "suspend", { reason: r }); }}>Suspend</Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => act(u.id, "force-logout")}>Force logout</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-300" onClick={() => { const r = window.prompt("Deletion reason (required, audit-logged):"); if (r) act(u.id, "delete", { reason: r }); }}>Delete</Button>
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

// ------------------------------------------------------------------- BILLING

function BillingPanel() {
  const [data, setData] = useState<{ plans: PlanRow[]; subscriptions: SubRow[]; payments: PayRow[]; ledger: LedgerRow[] } | null>(null);
  const [costs, setCosts] = useState<{ byDay: { day: string; costCents: number }[]; byProvider: { provider: string; costCents: number }[]; month: string } | null>(null);

  const load = useCallback(() => {
    apiGet<{ plans: PlanRow[]; subscriptions: SubRow[]; payments: PayRow[]; ledger: LedgerRow[] }>("/api/admin/billing").then(setData).catch(() => {});
    apiGet<{ byDay: { day: string; costCents: number }[]; byProvider: { provider: string; costCents: number }[]; month: string }>("/api/admin/costs").then(setCosts).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const patchPlan = async (code: string, field: string, promptLabel: string) => {
    const input = window.prompt(promptLabel);
    if (input === null) return;
    const body: Record<string, unknown> = { code };
    body[field] = input === "" ? null : parseInt(input, 10);
    if (field !== "priceCents" && !Number.isFinite(body[field] as number)) return;
    try {
      await apiSend("/api/admin/billing", "PATCH", body);
      load();
    } catch (e) {
      void e;
    }
  };

  if (!data) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-1 text-xs text-zinc-500">Plans, credits ledger, recorded payments and real infrastructure cost. No PSP is wired: prices stay unpublished until the cost model lands.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.plans.map((p) => (
          <Card key={p.code} className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{p.name} <span className="ml-1 font-mono text-[10px] text-zinc-500">{p.code}</span></CardTitle>
              <CardDescription className="text-[11px]">
                Price: {p.priceCents === null ? "unpublished" : formatCents(p.priceCents)} &middot; allowance {formatCents(p.monthlyFreeCreditCents)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 text-xs">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => patchPlan(p.code, "priceCents", "Monthly price in cents (empty = unpublished):")}>Price</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => patchPlan(p.code, "monthlyFreeCreditCents", "Monthly credit allowance in cents:")}>Allowance</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => patchPlan(p.code, "maxMinutesPerDay", "Max minutes per day:")}>Daily min</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => patchPlan(p.code, "maxModelUploads", "Max upload slots:")}>Uploads</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-zinc-800 bg-zinc-950">
        <CardHeader>
          <CardTitle className="text-base">Infrastructure cost ({costs?.month})</CardTitle>
          <CardDescription>Real CostRecord rows. Free providers contribute zero by definition.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">By provider (month)</p>
            {costs?.byProvider.length ? costs.byProvider.map((p) => (
              <div key={p.provider} className="flex justify-between border-b border-zinc-900 py-1">
                <span className="font-mono text-xs">{p.provider}</span>
                <span className="tabular-nums">{formatCents(p.costCents)}</span>
              </div>
            )) : <p className="text-xs text-zinc-500">No paid cost recorded (expected: free-first architecture).</p>}
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">Daily (month)</p>
            {costs?.byDay.length ? costs.byDay.slice(-8).map((d) => (
              <div key={d.day} className="flex justify-between border-b border-zinc-900 py-1">
                <span className="font-mono text-xs">{d.day}</span>
                <span className="tabular-nums">{formatCents(d.costCents)}</span>
              </div>
            )) : <p className="text-xs text-zinc-500">No cost rows yet.</p>}
          </div>
        </CardContent>
      </Card>

      <LedgerTable rows={data.ledger} />
    </div>
  );
}

interface PlanRow { code: string; name: string; priceCents: number | null; monthlyFreeCreditCents: number }
interface SubRow { id: string; status: string; plan: { code: string }; user: { email: string } }
interface PayRow { id: string; amountCents: number; provider: string; status: string; user: { email: string }; createdAt: string }
interface LedgerRow { id: string; deltaCents: number; balanceAfterCents: number; reason: string; user: { email: string }; createdAt: string }

function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <Card className="mt-6 border-zinc-800 bg-zinc-950">
      <CardHeader><CardTitle className="text-base">Recent credit movements</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-zinc-500">No ledger entries.</p> : (
          <div className="max-h-72 space-y-1 overflow-y-auto pr-2">
            {rows.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b border-zinc-900 py-1.5 text-xs">
                <span className="text-zinc-300">{e.user.email}</span>
                <span className="font-mono text-zinc-500">{e.reason}</span>
                <span className={`font-mono tabular-nums ${e.deltaCents >= 0 ? "text-zinc-100" : "text-red-400"}`}>
                  {e.deltaCents >= 0 ? "+" : ""}{formatCents(e.deltaCents)} → {formatCents(e.balanceAfterCents)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------- SUPPORT

interface AdminTicket {
  id: string; subject: string; status: string; priority: string;
  user: { id: string; email: string }; createdAt: string; updatedAt: string;
  messages: { id: string; authorRole: string; body: string; internal: boolean; createdAt: string }[];
}

function SupportPanel() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);

  const load = useCallback(() => {
    apiGet<{ tickets: AdminTicket[] }>("/api/admin/support").then((d) => setTickets(d.tickets)).catch(() => setTickets([]));
  }, []);
  useEffect(load, [load]);

  const send = async (id: string, body: string, internal: boolean, status?: string) => {
    if (!body.trim()) return;
    try {
      await apiSend(`/api/admin/support/tickets/${id}`, "POST", { body, internal, status });
      toast({ title: internal ? "Internal note added" : "Reply sent" });
      load();
    } catch (err) {
      toast({ title: "Send failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  if (tickets === null) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Support inbox</h1>
      <p className="mt-1 text-xs text-zinc-500">{tickets.length} ticket(s). Internal notes are never visible to users.</p>
      <div className="mt-5 space-y-4">
        {tickets.length === 0 ? <EmptyState title="No tickets" body="User tickets appear here with full threads." /> : null}
        {tickets.map((t) => (
          <Card key={t.id} className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">{t.subject}</CardTitle>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </div>
              <CardDescription className="text-xs">{t.user.email} &middot; updated {formatDate(t.updatedAt)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {t.messages.map((m) => (
                  <div key={m.id} className={`rounded-md border p-2 text-xs ${m.internal ? "border-white/25 bg-white/5" : m.authorRole === "USER" ? "border-zinc-800 bg-zinc-900" : "border-red-800 bg-red-950/30"}`}>
                    <div className="mb-0.5 flex justify-between font-mono text-[10px] text-zinc-400">
                      <span>{m.authorRole}{m.internal ? " / internal" : ""}</span>
                      <span>{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-zinc-200">{m.body}</p>
                  </div>
                ))}
              </div>
              <TicketReply onSend={(body, internal, status) => send(t.id, body, internal, status)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TicketReply({ onSend }: { onSend: (body: string, internal: boolean, status?: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Reply (or tick internal note)..." aria-label="Staff reply" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="bg-red-600 hover:bg-red-500" onClick={() => { onSend(body, false, "IN_PROGRESS"); setBody(""); }}>Reply</Button>
        <Button size="sm" variant="outline" onClick={() => { onSend(body, true); setBody(""); }}>Internal note</Button>
        <Button size="sm" variant="outline" onClick={() => { onSend(body || "Closing.", false, "RESOLVED"); setBody(""); }}>Resolve</Button>
        <Button size="sm" variant="outline" onClick={() => { onSend(body || "Closing.", false, "CLOSED"); setBody(""); }}>Close</Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- ALERTS

interface AlertRow { id: string; kind: string; severity: string; title: string; detail: string | null; status: string; createdAt: string; sourceRef: string | null }

function AlertsPanel() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const load = useCallback(() => {
    apiGet<{ alerts: AlertRow[] }>("/api/admin/alerts").then((d) => setAlerts(d.alerts)).catch(() => setAlerts([]));
  }, []);
  useEffect(load, [load]);

  const act = async (id: string, action: string) => {
    await apiSend(`/api/admin/alerts/${id}`, "POST", { action }).catch(() => {});
    toast({ title: `Alert ${action}ed` });
    load();
  };

  if (alerts === null) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Alerts</h1>
      <p className="mt-1 text-xs text-zinc-500">Raised by real detectors: stale workers, queue overload, budget thresholds, critical security events.</p>
      <div className="mt-5 space-y-2">
        {alerts.length === 0 ? <EmptyState title="No alerts" body="A quiet fleet is a healthy fleet. Alerts appear here the moment a detector trips." /> : null}
        {alerts.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <StatusBadge status={a.severity} />
                <StatusBadge status={a.status} />
                <span className="font-mono text-[10px] text-zinc-500">{a.kind}</span>
              </div>
              <p className="mt-1 text-sm">{a.title}</p>
              <p className="text-[11px] text-zinc-500">{formatDate(a.createdAt)}{a.sourceRef ? ` / ${a.sourceRef}` : ""}</p>
            </div>
            <div className="flex gap-2">
              {a.status === "OPEN" ? <Button size="sm" variant="outline" onClick={() => act(a.id, "ack")}>Acknowledge</Button> : null}
              {a.status !== "RESOLVED" ? <Button size="sm" variant="outline" onClick={() => act(a.id, "resolve")}>Resolve</Button> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ SECURITY

function SecurityPanel() {
  const [events, setEvents] = useState<SecEvent[] | null>(null);
  const [rateLimited, setRateLimited] = useState(0);
  useEffect(() => {
    apiGet<{ events: SecEvent[]; rateLimitedLastHour: number }>("/api/admin/security").then((d) => { setEvents(d.events); setRateLimited(d.rateLimitedLastHour); }).catch(() => setEvents([]));
  }, []);
  if (events === null) return <div className="flex justify-center py-16"><Spinner /></div>;
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Security events</h1>
      <p className="mt-1 text-xs text-zinc-500">Failed logins, lockouts, rate limiting, CSRF rejections, worker auth failures, permission denials. {rateLimited} rate-limit events in the last hour.</p>
      <div className="mt-5 max-h-[70vh] space-y-1.5 overflow-y-auto pr-2">
        {events.length === 0 ? <EmptyState title="No events recorded" body="Events stream in from live enforcement paths across the platform." /> : null}
        {events.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <StatusBadge status={e.severity} />
              <span className="font-mono">{e.kind}</span>
            </div>
            <div className="text-zinc-500">
              {e.userId ? `user ${e.userId.slice(0, 10)} ` : ""}{e.ip ? `${e.ip} ` : ""}{formatDate(e.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SecEvent { id: string; kind: string; severity: string; userId: string | null; ip: string | null; createdAt: string }

// --------------------------------------------------------------------- AUDIT

function AuditPanel() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<{ entries: AuditEntry[] }>("/api/admin/audit").then((d) => setEntries(d.entries)).catch(() => setEntries([]));
  }, []);
  useEffect(load, [load]);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await apiSend<{ ok: boolean; brokenAt: string | null; checked: number }>("/api/admin/audit", "POST", {});
      setVerifyResult(res.ok ? `Chain intact across ${res.checked} entries` : `CHAIN BROKEN at entry ${res.brokenAt}`);
      toast({ title: res.ok ? "Audit chain intact" : "Audit chain broken", variant: res.ok ? "default" : "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  if (entries === null) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-1 text-xs text-zinc-500">Hash-chained: each entry embeds the previous entry's hash, so removal or retro-editing breaks the chain.</p>
        </div>
        <div className="flex items-center gap-2">
          {verifyResult ? <span className={`text-xs ${verifyResult.includes("BROKEN") ? "text-red-400" : "text-zinc-100"}`}>{verifyResult}</span> : null}
          <Button size="sm" variant="outline" onClick={verify} disabled={verifying}>{verifying ? <Spinner /> : "Verify chain"}</Button>
        </div>
      </div>
      <div className="mt-5 max-h-[70vh] space-y-1.5 overflow-y-auto pr-2">
        {entries.map((e) => (
          <div key={e.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-red-300">{e.action}</span>
              <span className="text-zinc-500">{e.actorRole ?? "system"} {e.actorId ? e.actorId.slice(0, 10) : ""} / {formatDate(e.createdAt)}</span>
            </div>
            <div className="mt-1 text-zinc-400">
              {e.targetType ? `${e.targetType} ${e.targetId ?? ""} ` : ""}
              {e.reason ? `/ reason: ${e.reason}` : ""}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">hash {e.hash?.slice(0, 24)} prev {e.prevHash?.slice(0, 24)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AuditEntry { id: string; action: string; actorId: string | null; actorRole: string | null; targetType: string | null; targetId: string | null; reason: string | null; prevHash: string | null; hash: string | null; createdAt: string }

// ------------------------------------------------------------------ SETTINGS

interface SiteConfigFull {
  siteName: string; tagline: string; announcement: string | null; announcementLevel: "INFO" | "WARN";
  maintenanceMode: boolean; studioEnabled: boolean; uploadsEnabled: boolean;
  registrationEnabled: boolean; supportEnabled: boolean; animationIntensity: "OFF" | "SUBTLE" | "FULL";
}

function SettingsPanel() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SiteConfigFull | null>(null);
  const [versions, setVersions] = useState<{ id: string; action: string; createdAt: string; actorId: string | null; value: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<{ config: SiteConfigFull; versions: typeof versions }>("/api/admin/settings").then((d) => { setConfig(d.config); setVersions(d.versions); }).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const publish = async () => {
    if (!config) return;
    setBusy(true);
    try {
      await apiSend("/api/admin/settings", "PUT", config);
      toast({ title: "Settings published", description: "A version entry was recorded; rollback is one click away." });
      load();
    } catch (err) {
      toast({ title: "Publish failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (versionId: string) => {
    try {
      await apiSend("/api/admin/settings/rollback", "POST", { versionId });
      toast({ title: "Rolled back" });
      load();
    } catch (err) {
      toast({ title: "Rollback failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  if (!config) return <div className="flex justify-center py-16"><Spinner /></div>;

  const setField = <K extends keyof SiteConfigFull>(k: K, v: SiteConfigFull[K]) => setConfig({ ...config, [k]: v });

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold tracking-tight">Site settings</h1>
      <p className="mt-1 text-xs text-zinc-500">Publish flow with version history and rollback. Changes go live immediately on publish and are audit-logged.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader><CardTitle className="text-sm">Identity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Site name</Label>
              <Input id="s-name" value={config.siteName} onChange={(e) => setField("siteName", e.target.value)} className="border-zinc-800 bg-zinc-900" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-tagline">Tagline</Label>
              <Input id="s-tagline" value={config.tagline} onChange={(e) => setField("tagline", e.target.value)} className="border-zinc-800 bg-zinc-900" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-ann">Announcement banner (empty = hidden)</Label>
              <Input id="s-ann" value={config.announcement ?? ""} onChange={(e) => setField("announcement", e.target.value || null)} className="border-zinc-800 bg-zinc-900" />
              <div className="flex gap-2 pt-1">
                {(["INFO", "WARN"] as const).map((l) => (
                  <button key={l} onClick={() => setField("announcementLevel", l)}
                    className={`rounded border px-2 py-0.5 text-[10px] ${config.announcementLevel === l ? "border-red-700 text-red-300" : "border-zinc-700 text-zinc-500"}`}>{l}</button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader><CardTitle className="text-sm">Feature switches</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {([
              ["maintenanceMode", "Maintenance mode (pauses sessions and uploads)"],
              ["studioEnabled", "Studio enabled for users"],
              ["uploadsEnabled", "Voice uploads enabled"],
              ["registrationEnabled", "Registration enabled"],
              ["supportEnabled", "Support intake enabled"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-zinc-300">{label}</span>
                <Switch checked={config[key]} onCheckedChange={(v) => setField(key, v)} aria-label={label} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button className="bg-red-600 hover:bg-red-500" onClick={publish} disabled={busy}>{busy ? <Spinner /> : "Publish changes"}</Button>
        <span className="text-xs text-zinc-500">Every publish records a version; destructive actions require admin session.</span>
      </div>

      <Card className="mt-6 border-zinc-800 bg-zinc-950">
        <CardHeader><CardTitle className="text-sm">Version history</CardTitle></CardHeader>
        <CardContent className="max-h-64 space-y-1.5 overflow-y-auto text-xs">
          {versions.length === 0 ? <p className="text-zinc-500">No publishes yet.</p> : null}
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b border-zinc-900 py-1.5">
              <span className="font-mono text-zinc-400">{v.action}</span>
              <span className="text-zinc-500">{formatDate(v.createdAt)}</span>
              {v.action === "PUBLISH" ? <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => rollback(v.id)}>Restore this</Button> : <span />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------- BUDGETS

function BudgetsPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<{ policies: Policy[]; spend: { todayCents: number; monthCents: number } } | null>(null);
  const load = useCallback(() => {
    apiGet<{ policies: Policy[]; spend: { todayCents: number; monthCents: number } }>("/api/admin/budgets").then(setData).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const numOrNull = (v: FormDataEntryValue | null) => (v === "" || v === null ? null : parseInt(String(v), 10));
    const body = {
      scope: "GLOBAL",
      dailyBudgetCents: numOrNull(form.get("daily")),
      monthlyBudgetCents: numOrNull(form.get("monthly")),
      maxConcurrentPaidWorkers: numOrNull(form.get("workers")),
      maxPaidSessions: numOrNull(form.get("sessions")),
      onThreshold: String(form.get("onThreshold")),
      emergencyStop: form.get("emergencyStop") === "on",
    };
    try {
      await apiSend("/api/admin/budgets", "PUT", body);
      toast({ title: "Budget policy saved", description: "Enforced live by the scheduler and maintenance sweep (within 30 seconds)." });
      load();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  if (!data) return <div className="flex justify-center py-16"><Spinner /></div>;
  const global = data.policies.find((p) => p.scope === "GLOBAL");

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight">Budgets and cost control</h1>
      <p className="mt-1 text-xs text-zinc-500">
        Paid capacity only. Free compute (LOCAL, KAGGLE_ASSISTED) is capped by its own quotas and never creates spend. Spend today: {formatCents(data.spend.todayCents)} / month: {formatCents(data.spend.monthCents)}.
      </p>
      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="b-daily">Daily budget (cents)</Label>
          <Input id="b-daily" name="daily" type="number" min="0" defaultValue={global?.dailyBudgetCents ?? ""} className="border-zinc-800 bg-zinc-900" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-monthly">Monthly budget (cents)</Label>
          <Input id="b-monthly" name="monthly" type="number" min="0" defaultValue={global?.monthlyBudgetCents ?? ""} className="border-zinc-800 bg-zinc-900" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-workers">Max concurrent paid workers</Label>
          <Input id="b-workers" name="workers" type="number" min="0" defaultValue={global?.maxConcurrentPaidWorkers ?? ""} className="border-zinc-800 bg-zinc-900" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-sessions">Max paid sessions</Label>
          <Input id="b-sessions" name="sessions" type="number" min="0" defaultValue={global?.maxPaidSessions ?? ""} className="border-zinc-800 bg-zinc-900" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-threshold">When a threshold is reached</Label>
          <select id="b-threshold" name="onThreshold" defaultValue={global?.onThreshold ?? "QUEUE_ONLY"} className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 text-sm" aria-label="Threshold response">
            <option value="WARN">WARN: allow, keep alerting</option>
            <option value="QUEUE_ONLY">QUEUE_ONLY: no new paid capacity</option>
            <option value="EMERGENCY_STOP">EMERGENCY_STOP: halt paid provisioning</option>
          </select>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" id="b-stop" name="emergencyStop" defaultChecked={global?.emergencyStop ?? false} className="h-4 w-4 rounded" aria-label="Emergency stop" />
          <Label htmlFor="b-stop" className="text-sm font-normal">EMERGENCY STOP: refuse all new paid capacity immediately (applies within 30 seconds)</Label>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" className="bg-red-600 hover:bg-red-500">Save policy</Button>
        </div>
      </form>
    </div>
  );
}

interface Policy {
  id: string; scope: string; providerCode: string | null; dailyBudgetCents: number | null;
  monthlyBudgetCents: number | null; maxConcurrentPaidWorkers: number | null; maxPaidSessions: number | null;
  onThreshold: string; emergencyStop: boolean;
}

// ------------------------------------------------------------------ TEST LAB

interface TestRun { id: string; kind: string; scope: string; status: string; result: string | null; createdAt: string; completedAt: string | null }

const TESTS = [
  { kind: "TRANSPORT", label: "Audio gateway", desc: "Real engine.io handshake against the gateway service (port 3003)." },
  { kind: "WORKER_HEALTH", label: "Worker health", desc: "PING command round trip through the live command queue." },
  { kind: "CONVERSION", label: "Conversion", desc: "One second of synthesized audio through a live worker; measures infer time and verifies output." },
  { kind: "RATE_LIMIT", label: "Rate limiter", desc: "Bursts the health endpoint and counts 429 responses. Briefly consumes this machine's own window." },
  { kind: "SCALE_TO_ZERO", label: "Scale-to-zero", desc: "Reports idle paid workers and emergency stop state." },
  { kind: "FAILOVER", label: "Failover", desc: "Drains a worker with TEST sessions attached and verifies the maintenance loop ends them." },
];

// Control-plane managed services (audio gateway). The control plane spawns
// and supervises the gateway so it never depends on an operator shell.
function GatewayServiceCard() {
  const { toast } = useToast();
  const [svc, setSvc] = useState<{ port: number; listening: boolean; managed: boolean; pid: number | null; health: { ok: boolean }; logPath: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<typeof svc>("/api/admin/services/gateway").then(setSvc).catch(() => setSvc(null));
  }, []);
  useEffect(load, [load]);

  const act = async (action?: string) => {
    setBusy(true);
    try {
      await apiSend("/api/admin/services/gateway", "POST", action ? { action } : {});
      toast({ title: action === "stop" ? "Gateway stop requested" : "Gateway start requested" });
      setTimeout(load, 1200);
    } catch (err) {
      toast({ title: "Gateway action failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-zinc-800 bg-zinc-950">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Audio gateway service</CardTitle>
        <CardDescription>Real-time audio transport on port {svc?.port ?? 3003}. The control plane supervises the process; logs at {svc?.logPath ?? ".zscripts/gateway.log"}.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <StatusBadge status={svc?.listening ? "READY" : "UNHEALTHY"} />
        <span className="text-xs text-zinc-400">{svc?.listening ? (svc.health?.ok ? "handshake ok" : "listening, handshake failed") : "not listening"}{svc?.managed ? ` (managed pid ${svc.pid})` : ""}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act()}>Start</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("stop")}>Stop</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TestLabPanel() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<TestRun[] | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ kind: string; passed: boolean; detail: Record<string, unknown> } | null>(null);

  const load = useCallback(() => {
    apiGet<{ runs: TestRun[] }>("/api/admin/testlab").then((d) => setRuns(d.runs)).catch(() => setRuns([]));
  }, []);
  useEffect(load, [load]);

  const run = async (kind: string) => {
    setRunning(kind);
    try {
      const res = await apiSend<{ result: { passed: boolean } & Record<string, unknown> }>("/api/admin/testlab", "POST", { kind });
      setLastResult({ kind, passed: res.result.passed, detail: res.result });
      toast({ title: res.result.passed ? `${kind} passed` : `${kind} failed`, description: summarize(res.result) });
      load();
    } catch (err) {
      toast({ title: "Test error", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Test lab</h1>
      <p className="mt-1 max-w-3xl text-xs text-zinc-500">
        Real tests against the real system, scoped to TEST so customer state is never damaged. Every run is recorded. Destructive paths (failover) only touch isTest sessions.
      </p>
      <div className="mt-5">
        <GatewayServiceCard />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TESTS.map((t) => (
          <Card key={t.kind} className="border-zinc-800 bg-zinc-950">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.label}</CardTitle>
              <CardDescription className="text-[11px]">{t.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline" onClick={() => run(t.kind)} disabled={running !== null}>
                {running === t.kind ? <Spinner /> : "Run test"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {lastResult ? (
        <Card className="mt-6 border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-sm">Last result: {lastResult.kind} {lastResult.passed ? "PASSED" : "FAILED"}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-900 p-3 font-mono text-[10px] text-zinc-100">{JSON.stringify(lastResult.detail, null, 2)}</pre>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6 border-zinc-800 bg-zinc-950">
        <CardHeader><CardTitle className="text-sm">Run history</CardTitle></CardHeader>
        <CardContent className="max-h-72 space-y-1 overflow-y-auto text-xs">
          {runs === null ? <Spinner /> : runs.length === 0 ? <p className="text-zinc-500">No runs yet.</p> : null}
          {runs?.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-zinc-900 py-1.5">
              <span className="font-mono">{r.kind}</span>
              <StatusBadge status={r.status} />
              <span className="text-zinc-500">{formatDate(r.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function summarize(result: Record<string, unknown>): string {
  if (result.rttMs !== undefined) return `RTT ${result.rttMs}ms via ${result.worker ?? "worker"}`;
  if (result.totalMs !== undefined) return `total ${result.totalMs}ms, infer ${result.inferMs ?? "?"}ms`;
  if (result.httpMs !== undefined) return `handshake ${result.httpMs}ms`;
  if (result.http429 !== undefined) return `${result.http429} x 429 of ${result.burst}`;
  if (result.idlePaidWorkers !== undefined) return `${result.idlePaidWorkers} idle paid / ${result.freeWorkers} free workers`;
  return JSON.stringify(result).slice(0, 120);
}
