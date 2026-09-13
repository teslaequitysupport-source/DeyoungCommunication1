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
import { StatusBadge, EmptyState, formatDate, Spinner, SkeletonRows } from "@/components/app/ui-bits";
import { minLengthHint } from "@/lib/client/form-validate";
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

interface CloneSample {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  sha256: string;
}

interface CloneRequest {
  id: string;
  name: string;
  description: string | null;
  status: string;
  statusNote: string | null;
  totalBytes: number;
  totalSec: number | null;
  createdAt: string;
  samples: CloneSample[];
}

// Client-side caps, mirrors of the server limits (the server stays the source
// of truth; these exist so the browser can reject a bad file before upload).
const CLONE_MAX_FILES = 3;
const CLONE_MAX_FILE_MB = 12;
const CLONE_ACCEPT = "audio/*,.wav,.mp3,.m4a,.ogg,.oga,.flac,.webm";

function prettyBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function prettySec(sec: number | null | undefined): string {
  if (!sec || !Number.isFinite(sec)) return "unknown";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Duration is measured in the browser with the Web Audio API. It is advisory
// only: decoding can fail on exotic codecs, and a null duration never blocks
// a submission the server would accept.
async function audioDurationSec(file: File): Promise<number | null> {
  try {
    const ctx = new AudioContext();
    const buf = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf);
    const d = decoded.duration;
    void ctx.close();
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

export default function ModelsView({ config }: { config: SiteConfig | null }) {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [mine, setMine] = useState<MyModel[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Clone dialog state.
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [clones, setClones] = useState<CloneRequest[] | null>(null);
  const [cloneFiles, setCloneFiles] = useState<File[] | null>(null);
  const [cloneDurations, setCloneDurations] = useState<Record<string, number | null>>({});
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneNameError, setCloneNameError] = useState<string | null>(null);

  const load = () => {
    apiGet<{ models: CatalogModel[] }>("/api/models").then((d) => setCatalog(d.models)).catch(() => {});
    apiGet<{ models: MyModel[] }>("/api/models/mine").then((d) => setMine(d.models)).catch(() => setMine([]));
    apiGet<{ requests: CloneRequest[] }>("/api/clone/mine").then((d) => setClones(d.requests)).catch(() => setClones([]));
  };
  useEffect(load, []);

  const onCloneFilesPicked = (list: FileList | null) => {
    setCloneError(null);
    const picked = list ? Array.from(list) : [];
    if (picked.length > CLONE_MAX_FILES) {
      setCloneError(`Pick at most ${CLONE_MAX_FILES} audio files per clone request.`);
      setCloneFiles(null);
      return;
    }
    for (const f of picked) {
      if (f.size > CLONE_MAX_FILE_MB * 1024 * 1024) {
        setCloneError(`"${f.name}" is ${prettyBytes(f.size)}; the limit is ${CLONE_MAX_FILE_MB}MB per file.`);
        setCloneFiles(null);
        return;
      }
    }
    setCloneFiles(picked.length > 0 ? picked : null);
    // Measure durations in the background; failures stay silent (advisory).
    for (const f of picked) {
      if (!(f.name in cloneDurations)) {
        audioDurationSec(f).then((d) => setCloneDurations((prev) => ({ ...prev, [f.name]: d })));
      }
    }
  };

  const onCloneSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCloneError(null);
    setCloneNameError(null);
    const form = new FormData(e.currentTarget);
    const nameHint = minLengthHint(String(form.get("name") ?? ""), 2, "a voice name");
    if (nameHint) {
      setCloneNameError(nameHint);
      return;
    }
    if (!cloneFiles || cloneFiles.length === 0) {
      setCloneError("Attach at least one audio file from your device.");
      return;
    }
    const totalSec = cloneFiles.reduce((acc, f) => acc + (cloneDurations[f.name] ?? 0), 0);
    form.delete("files");
    for (const f of cloneFiles) form.append("files", f);
    form.set("totalSec", totalSec > 0 ? String(Math.round(totalSec)) : "");
    setCloneBusy(true);
    try {
      const res = await apiUpload<{ message: string }>("/api/clone", form);
      toast({ title: "Clone request received", description: res.message });
      setCloneOpen(false);
      setCloneFiles(null);
      setCloneDurations({});
      load();
    } catch (err) {
      setCloneError(err instanceof ApiClientError ? err.message : "Upload failed. Try again.");
    } finally {
      setCloneBusy(false);
    }
  };

  const removeClone = async (id: string) => {
    if (!window.confirm("Delete this clone request? The stored audio samples are removed with it.")) return;
    try {
      await apiSend(`/api/clone/${id}`, "DELETE");
      toast({ title: "Clone request deleted", description: "The audio samples were removed from the platform database." });
      load();
    } catch (err) {
      toast({ title: "Deletion failed", description: err instanceof ApiClientError ? err.message : undefined, variant: "destructive" });
    }
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-500" disabled={config?.uploadsEnabled === false}>Clone from audio</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Clone a voice from your device</DialogTitle>
                <DialogDescription>
                  Upload recordings of the voice you want to clone. One to three files, up to {CLONE_MAX_FILE_MB}MB each. wav, mp3, m4a, ogg, flac or webm.
                </DialogDescription>
              </DialogHeader>
              <div className="border border-white/15 bg-white/5 p-3 text-xs leading-relaxed text-zinc-300">
                <p className="font-medium text-zinc-100">What actually happens with your audio</p>
                <p className="mt-1">
                  It is verified by content, hashed and stored privately in the platform database. Nobody else can see it and you can delete it at any time.
                  Voice training is not available in this deployment yet: your request stays queued as RECEIVED until real training capacity exists. We do not simulate progress.
                </p>
              </div>
              <form onSubmit={onCloneSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cl-name">Voice name</Label>
                  <Input
                    id="cl-name"
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="e.g. My narrator voice"
                    aria-invalid={cloneNameError ? true : undefined}
                  />
                  {cloneNameError ? <p className="text-xs text-red-400" role="alert">{cloneNameError}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cl-desc">Description (optional)</Label>
                  <Textarea id="cl-desc" name="description" rows={2} maxLength={1000} placeholder="Whose voice is this, and what is it for?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cl-files">Audio files</Label>
                  <Input id="cl-files" name="files" type="file" accept={CLONE_ACCEPT} multiple onChange={(e) => onCloneFilesPicked(e.target.files)} />
                  {cloneFiles && cloneFiles.length > 0 ? (
                    <ul className="space-y-1 text-xs text-zinc-400" aria-live="polite">
                      {cloneFiles.map((f) => (
                        <li key={f.name} className="flex flex-wrap justify-between gap-2">
                          <span className="min-w-0 truncate">{f.name}</span>
                          <span className="tabular-nums text-zinc-500">
                            {prettyBytes(f.size)} · {prettySec(cloneDurations[f.name])}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-500">Tip: clean recordings with little background noise, at least 30 seconds in total, work best.</p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="cl-attest" name="attested" value="true" required className="mt-1" />
                  <Label htmlFor="cl-attest" className="text-xs font-normal leading-relaxed text-zinc-500">
                    I have the rights or the spoken consent of the person whose voice is in these recordings, and I accept the Voice Rights Policy. A consent record with a cryptographic evidence hash is stored for this submission.
                  </Label>
                </div>
                {cloneError ? (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{cloneError}</AlertDescription>
                  </Alert>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCloneOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-red-600 hover:bg-red-500" disabled={cloneBusy}>
                    {cloneBusy ? <Spinner /> : "Submit audio"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={config?.uploadsEnabled === false}>Upload RVC model (.pth)</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit a voice model</DialogTitle>
              <DialogDescription>
                RVC .pth checkpoint, up to 300MB. The platform stores and hashes the file and never executes it server-side. Moderation is human. Upload slots are set by your plan.
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
              <p className="text-xs text-zinc-500">
                Storage note: model files live on the deployment disk. On Railway without a persistent volume they are cleared when the service redeploys; the name, size and sha256 stay in the database, and a removed file can simply be uploaded again.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-500" disabled={busy}>
                  {busy ? <Spinner /> : "Submit for moderation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="catalog" className="mt-6">
        <TabsList>
          <TabsTrigger value="catalog">Catalog ({catalog.length})</TabsTrigger>
          <TabsTrigger value="mine">My uploads ({mine?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="clones">My clones ({clones?.length ?? 0})</TabsTrigger>
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
                      <a href={m.licenseUrl} target="_blank" rel="noreferrer noopener" className="text-red-500 underline">License terms</a>
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
                        {m.rejectionReason ? <div className="mt-1 text-xs text-red-400">Rejected: {m.rejectionReason}</div> : null}
                        {m.takedownReason ? <div className="mt-1 text-xs text-zinc-200">Takedown: {m.takedownReason}</div> : null}
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
            <Alert className="mt-4 border-white/25 bg-white/5">
              <AlertDescription className="text-zinc-100">Uploads are temporarily disabled by an administrator.</AlertDescription>
            </Alert>
          ) : null}
        </TabsContent>

        <TabsContent value="clones" className="mt-4">
          {clones === null ? (
            <SkeletonRows rows={3} />
          ) : clones.length === 0 ? (
            <EmptyState
              title="No clone requests yet"
              body="Use Clone from audio to upload recordings from your device. Your samples stay private, are hashed on arrival, and can be deleted by you at any time."
            />
          ) : (
            <div className="space-y-4">
              {clones.map((c) => (
                <Card key={c.id} className="border-zinc-200 dark:border-zinc-800">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <StatusBadge status={c.status} />
                    </div>
                    {c.description ? <CardDescription className="text-xs">{c.description}</CardDescription> : null}
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-zinc-500">
                    <p className="tabular-nums">
                      {c.samples.length} sample{c.samples.length === 1 ? "" : "s"} · {prettyBytes(c.totalBytes)} · audio length {prettySec(c.totalSec)} · submitted {formatDate(c.createdAt)}
                    </p>
                    <ul className="space-y-1">
                      {c.samples.map((s) => (
                        <li key={s.id} className="flex flex-wrap justify-between gap-2">
                          <span className="min-w-0 truncate">{s.fileName}</span>
                          <span className="tabular-nums text-zinc-600">
                            {prettyBytes(s.sizeBytes)} · sha256 {s.sha256.slice(0, 12)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {c.statusNote ? (
                      <p className="border border-white/15 bg-white/5 p-2 leading-relaxed text-zinc-300">{c.statusNote}</p>
                    ) : null}
                    <div className="pt-1">
                      <Button variant="outline" size="sm" onClick={() => removeClone(c.id)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
