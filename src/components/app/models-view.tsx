"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatusBadge, EmptyState, formatDate, Spinner } from "@/components/app/ui-bits";
import { apiGet, apiSend, apiUpload, ApiClientError, CatalogModel } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { SiteConfig } from "@/components/app/app-shell";

// Voice catalog + open uploads + moderation status. The attestation here is a
// legal acknowledgment; the server stores a consent record with evidence hash.

interface MyModel {
  id: string;
  name: string;
  status: string;
  description: string | null;
  licenseName: string;
  licenseVerified: boolean;
  fileName: string | null;
  fileSize: number | null;
  fileSha256: string | null;
  rejectionReason: string | null;
  takedownReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export default function ModelsView({ config }: { config: SiteConfig | null }) {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [mine, setMine] = useState<MyModel[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    apiGet<{ models: CatalogModel[] }>("/api/models").then((d) => setCatalog(d.models)).catch(() => {});
    apiGet<{ models: MyModel[] }>("/api/models/mine").then((d) => setMine(d.models)).catch(() => setMine([]));
  };
  useEffect(load, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await apiUpload("/api/models/upload", form);
      toast({ title: "Model submitted", description: "It enters the moderation queue and appears in the catalog only after approval." });
      setOpen(false);
      load();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Upload failed";
      toast({ title: "Upload rejected", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const report = async (id: string) => {
    const reason = window.prompt("Report reason: IMPERSONATION, NO_RIGHTS, FRAUD, HARASSMENT or OTHER\nDescribe the problem in one line:");
    if (!reason) return;
    const upper = reason.split(":")[0].trim().toUpperCase();
    const valid = ["IMPERSONATION", "NO_RIGHTS", "FRAUD", "HARASSMENT", "OTHER"];
    const matched = valid.find((v) => upper.includes(v)) ?? "OTHER";
    try {
      await apiSend(`/api/models/${id}/report`, "POST", { reason: matched, detail: reason });
      toast({ title: "Report filed", description: "Moderators will review it. Thank you." });
    } catch (err) {
      toast({ title: "Could not file report", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this model? Published models are taken down immediately; pending ones are deleted.")) return;
    try {
      await apiSend(`/api/models/${id}`, "DELETE");
      toast({ title: "Model removed" });
      load();
    } catch (err) {
      toast({ title: "Removal failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Voices</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Approved models only. Community uploads carry license metadata and a signed rights attestation, and every listing has a working report link.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-500" disabled={config?.uploadsEnabled === false}>Upload RVC model</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit a voice model</DialogTitle>
              <DialogDescription>
                RVC .pth checkpoint, up to 300MB. The platform stores and hashes the file and never executes it server-side. Moderation is human.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="up-name">Model name</Label>
                <Input id="up-name" name="name" required minLength={2} maxLength={80} placeholder="e.g. Warm Narrator" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="up-desc">Description</Label>
                <Textarea id="up-desc" name="description" rows={2} maxLength={1000} placeholder="What does it sound like? What training data rights do you hold?" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="up-license">License name (required)</Label>
                  <Input id="up-license" name="licenseName" required minLength={2} maxLength={120} placeholder="e.g. MIT, CC-BY-4.0, Own voice" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="up-license-url">License link (optional)</Label>
                  <Input id="up-license-url" name="licenseUrl" type="url" placeholder="https://" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="up-file">Model file (.pth)</Label>
                <Input id="up-file" name="file" ref={fileRef} type="file" accept=".pth" required />
                <p className="text-xs text-zinc-500">The file must be a torch checkpoint. Everything else is rejected before parsing.</p>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="up-attest" name="rightsAttested" value="true" required className="mt-1" />
                <Label htmlFor="up-attest" className="text-xs font-normal leading-relaxed text-zinc-500">
                  I confirm I hold the rights or express permission for this voice model, that it does not impersonate a real person without authorization, and I accept the Voice Rights Policy including immediate takedown terms. A consent record with a cryptographic evidence hash is stored for this submission.
                </Label>
              </div>
              <input type="hidden" name="engine" value="RVC" />
              <input type="hidden" name="licenseVerified" value="false" />
              <input type="hidden" name="rightsAttested" value="true" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-violet-600 hover:bg-violet-500" disabled={busy}>
                  {busy ? <Spinner /> : "Submit for moderation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="catalog" className="mt-6">
        <TabsList>
          <TabsTrigger value="catalog">Catalog ({catalog.length})</TabsTrigger>
          <TabsTrigger value="mine">My uploads ({mine?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          {catalog.length === 0 ? (
            <EmptyState title="No approved models yet" body="Built-in DSP voices are seeded at bootstrap; community uploads appear here after moderation." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((m) => (
                <Card key={m.id} className="border-zinc-200 dark:border-zinc-800">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{m.name}</CardTitle>
                      <StatusBadge status={m.kind === "SYSTEM_DSP" ? "APPROVED" : "ACTIVE"} />
                    </div>
                    <CardDescription className="text-xs">{m.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs text-zinc-500">
                    <p>Engine: {m.engine} &middot; {m.sampleRate / 1000} kHz &middot; v{m.version}</p>
                    <p>License: {m.licenseName} {m.licenseVerified ? "(verified)" : "(unverified)"}</p>
                    {m.licenseUrl ? (
                      <a href={m.licenseUrl} target="_blank" rel="noreferrer noopener" className="text-violet-500 underline">License terms</a>
                    ) : null}
                    <div className="pt-2">
                      <Button variant="outline" size="sm" onClick={() => report(m.id)}>Report</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {mine === null ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : mine.length === 0 ? (
            <EmptyState title="No uploads yet" body="Your submissions and their moderation status will appear here. Rejections always carry a reason." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">License</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {mine.map((m) => (
                    <tr key={m.id} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="font-mono text-[10px] text-zinc-400">{m.fileName} &middot; sha256 {(m.fileSha256 ?? "").slice(0, 12)}</div>
                        {m.rejectionReason ? <div className="mt-1 text-xs text-rose-400">Rejected: {m.rejectionReason}</div> : null}
                        {m.takedownReason ? <div className="mt-1 text-xs text-amber-400">Takedown: {m.takedownReason}</div> : null}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                      <td className="px-4 py-3 text-xs">{m.licenseName}{m.licenseVerified ? " (verified)" : ""}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{formatDate(m.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" onClick={() => remove(m.id)}>Remove</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {config?.uploadsEnabled === false ? (
            <Alert className="mt-4 border-amber-800 bg-amber-950/30">
              <AlertDescription className="text-amber-200">Uploads are temporarily disabled by an administrator.</AlertDescription>
            </Alert>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
