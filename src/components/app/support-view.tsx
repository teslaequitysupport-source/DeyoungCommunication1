"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, EmptyState, formatDate, Spinner } from "@/components/app/ui-bits";
import { apiGet, apiSend, ApiClientError } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { SiteConfig } from "@/components/app/app-shell";

interface TicketMessage { id: string; role: string; body: string; createdAt: string }
interface Ticket { id: string; subject: string; status: string; priority: string; createdAt: string; updatedAt: string; messages: TicketMessage[] }

export default function SupportView({ config }: { config: SiteConfig | null }) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [priority, setPriority] = useState("NORMAL");

  const load = () => {
    apiGet<{ tickets: Ticket[] }>("/api/support/tickets").then((d) => setTickets(d.tickets)).catch(() => setTickets([]));
  };
  useEffect(load, []);

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await apiSend("/api/support/tickets", "POST", {
        subject: String(form.get("subject") || ""),
        body: String(form.get("body") || ""),
        priority,
      });
      toast({ title: "Ticket created", description: "We reply in the ticket thread; you also get an inbox notification." });
      setOpen(false);
      load();
    } catch (err) {
      toast({ title: "Could not create ticket", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const reply = async (id: string, body: string, close: boolean) => {
    if (!body.trim()) return;
    try {
      await apiSend(`/api/support/tickets/${id}`, "POST", { body, status: close ? "CLOSED" : "OPEN" });
      toast({ title: close ? "Ticket closed" : "Reply sent" });
      load();
    } catch (err) {
      toast({ title: "Could not send", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Real ticketing: threaded conversations, status tracking and notifications. Replies from staff appear inline.</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-500" onClick={() => setOpen((v) => !v)} disabled={config?.supportEnabled === false}>
          {open ? "Close form" : "New ticket"}
        </Button>
      </div>

      {config?.supportEnabled === false ? (
        <p className="mt-4 rounded-lg border border-white/25 bg-white/5 p-3 text-sm text-zinc-100">Support intake is temporarily closed by an administrator.</p>
      ) : null}

      {open ? (
        <Card className="mt-4 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Describe the problem</CardTitle>
            <CardDescription>Include what you did, what you expected and what happened. Attachments are not supported in this build; paste logs as text.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="t-subject">Subject</Label>
                <Input id="t-subject" name="subject" required minLength={4} maxLength={150} placeholder="Brief summary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="t-priority" aria-label="Priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-body">Details</Label>
                <Textarea id="t-body" name="body" required minLength={10} maxLength={5000} rows={5} />
              </div>
              <Button type="submit" className="bg-red-600 hover:bg-red-500" disabled={busy}>{busy ? <Spinner /> : "Open ticket"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-8 space-y-4">
        {tickets === null ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : tickets.length === 0 ? (
          <EmptyState title="No tickets" body="Anything broken, confusing or suspicious: open a ticket. Staff see it in the command centre inbox." />
        ) : (
          tickets.map((t) => (
            <Card key={t.id} className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{t.subject}</CardTitle>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                </div>
                <CardDescription className="text-xs">Opened {formatDate(t.createdAt)} &middot; updated {formatDate(t.updatedAt)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.messages.map((m) => (
                  <div key={m.id} className={`rounded-lg border p-3 text-sm ${m.role === "USER" ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60" : "border-red-800 bg-red-950/30"}`}>
                    <div className="mb-1 flex justify-between text-[11px] text-zinc-400">
                      <span className="font-mono uppercase">{m.role === "USER" ? "you" : m.role}</span>
                      <span>{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
                {t.status !== "CLOSED" ? (
                  <ReplyBox onSend={(body, close) => reply(t.id, body, close)} canClose={t.status !== "CLOSED"} />
                ) : (
                  <p className="text-xs text-zinc-400">This ticket is closed. Open a new ticket if the problem returns.</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function ReplyBox({ onSend, canClose }: { onSend: (body: string, close: boolean) => void; canClose: boolean }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Write a reply..." maxLength={5000} aria-label="Reply text" />
      <div className="flex gap-2">
        <Button size="sm" className="bg-red-600 hover:bg-red-500" onClick={() => { onSend(body, false); setBody(""); }}>Send reply</Button>
        {canClose ? (
          <Button size="sm" variant="outline" onClick={() => { onSend(body || "Closing this ticket.", true); setBody(""); }}>Close ticket</Button>
        ) : null}
      </div>
    </div>
  );
}
